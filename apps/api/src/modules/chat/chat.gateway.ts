import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { WS_EVENTS } from '@crossbot/shared';
import { ChatService } from './chat.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { ScenarioService } from '../scenario/scenario.service';
import { NotificationService } from '../notification/notification.service';

interface JoinRoomData {
  sessionId: string;
  conversationId?: string;
  userContext: {
    url: string;
    title: string;
    userAgent: string;
    lmsUser?: {
      id: string;
      name: string;
      email?: string;
    };
  };
}

interface SendMessageData {
  conversationId: string;
  contentType: 'TEXT' | 'IMAGE' | 'OPTION_SELECT';
  content: string;
  payload?: Record<string, unknown>;
}

interface SelectOptionData {
  conversationId: string;
  nodeId: number;
}

interface PageViewData {
  url: string;
  title: string;
}

interface TypingData {
  conversationId: string;
  isTyping: boolean;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('ChatGateway');
  private userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>
  private adminSockets = new Map<string, Set<string>>(); // adminId -> Set<socketId>

  constructor(
    private chatService: ChatService,
    private conversationService: ConversationService,
    private messageService: MessageService,
    private scenarioService: ScenarioService,
    private notificationService: NotificationService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // ユーザーソケットから削除
    for (const [userId, sockets] of this.userSockets) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
        break;
      }
    }

    // 管理者ソケットから削除
    for (const [adminId, sockets] of this.adminSockets) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.adminSockets.delete(adminId);
        }
        break;
      }
    }
  }

  @SubscribeMessage(WS_EVENTS.JOIN_ROOM)
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomData,
  ) {
    try {
      // ユーザーを作成または取得
      const user = await this.chatService.getOrCreateUser(data.sessionId, data.userContext);

      // ユーザーソケットを登録
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)?.add(client.id);

      // 会話を取得または作成
      let conversation;
      if (data.conversationId) {
        conversation = await this.conversationService.findById(data.conversationId);
      }

      if (!conversation) {
        conversation = await this.conversationService.create(user.id, {
          url: data.userContext.url,
          title: data.userContext.title,
        });
      }

      // ルームに参加
      await client.join(`conversation:${conversation.id}`);
      await client.join(`user:${user.id}`);

      // 初期シナリオを取得
      const initialScenario = await this.scenarioService.getInitialOptions();

      // 接続確認を送信
      client.emit(WS_EVENTS.CONNECTION_ACK, {
        userId: user.id,
        conversationId: conversation.id,
        status: conversation.status,
        scenario: initialScenario,
      });

      this.logger.log(`User ${user.id} joined conversation ${conversation.id}`);
    } catch (error) {
      this.logger.error('Join room error:', error);
      client.emit(WS_EVENTS.ERROR, { message: '接続に失敗しました' });
    }
  }

  @SubscribeMessage(WS_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageData,
  ) {
    try {
      const message = await this.messageService.create({
        conversationId: data.conversationId,
        senderType: 'USER',
        contentType: data.contentType,
        content: data.content,
        payload: data.payload,
      });

      // 会話ルームにメッセージを配信
      this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.NEW_MESSAGE, message);

      // 管理者ルームにも通知
      this.server.to('admin-room').emit(WS_EVENTS.NEW_MESSAGE, message);

      this.logger.log(`Message sent in conversation ${data.conversationId}`);
    } catch (error) {
      this.logger.error('Send message error:', error);
      client.emit(WS_EVENTS.ERROR, { message: 'メッセージ送信に失敗しました' });
    }
  }

  @SubscribeMessage(WS_EVENTS.SELECT_OPTION)
  async handleSelectOption(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SelectOptionData,
  ) {
    try {
      // シナリオ処理
      const response = await this.scenarioService.processSelection(data.conversationId, data.nodeId);

      // ユーザーの選択をメッセージとして記録
      const userMessage = await this.messageService.create({
        conversationId: data.conversationId,
        senderType: 'USER',
        contentType: 'OPTION_SELECT',
        content: response.message,
        payload: { nodeId: data.nodeId },
      });

      this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.NEW_MESSAGE, userMessage);

      // シナリオ応答を送信
      client.emit(WS_EVENTS.SCENARIO_RESPONSE, response);

      // HANDOVERアクションの場合
      if (response.action === 'HANDOVER') {
        const conversation = await this.conversationService.updateStatus(data.conversationId, 'WAITING');

        // ステータス変更を通知
        this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.STATUS_CHANGE, {
          conversationId: data.conversationId,
          status: 'WAITING',
        });

        // 管理者に通知
        this.server.to('admin-room').emit(WS_EVENTS.NEW_REQUEST, {
          conversation,
        });

        // 外部通知（Slack等）
        await this.notificationService.notifyNewRequest(conversation);
      }

      this.logger.log(`Option selected in conversation ${data.conversationId}: nodeId=${data.nodeId}`);
    } catch (error) {
      this.logger.error('Select option error:', error);
      client.emit(WS_EVENTS.ERROR, { message: 'シナリオ処理に失敗しました' });
    }
  }

  @SubscribeMessage(WS_EVENTS.PAGE_VIEW)
  async handlePageView(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PageViewData & { userId: string },
  ) {
    try {
      await this.chatService.recordPageView(data.userId, data.url, data.title);

      // 管理者に行動情報を送信
      this.server.to('admin-room').emit(WS_EVENTS.USER_ACTIVITY, {
        userId: data.userId,
        type: 'page_view',
        detail: { url: data.url, title: data.title },
      });
    } catch (error) {
      this.logger.error('Page view error:', error);
    }
  }

  @SubscribeMessage(WS_EVENTS.TYPING)
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TypingData & { senderType: 'USER' | 'ADMIN' },
  ) {
    this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.TYPING_INDICATOR, {
      conversationId: data.conversationId,
      senderType: data.senderType,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('join_admin_room')
  async handleJoinAdminRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { adminId: string },
  ) {
    await client.join('admin-room');

    if (!this.adminSockets.has(data.adminId)) {
      this.adminSockets.set(data.adminId, new Set());
    }
    this.adminSockets.get(data.adminId)?.add(client.id);

    this.logger.log(`Admin ${data.adminId} joined admin-room`);
  }

  // 管理者からユーザーへのメッセージ送信
  async sendAdminMessage(conversationId: string, adminId: string, content: string, contentType: 'TEXT' | 'IMAGE' = 'TEXT', payload?: Record<string, unknown>) {
    const message = await this.messageService.create({
      conversationId,
      senderType: 'ADMIN',
      contentType,
      content,
      payload,
    });

    this.server.to(`conversation:${conversationId}`).emit(WS_EVENTS.NEW_MESSAGE, message);
    return message;
  }

  // ステータス変更の通知
  async notifyStatusChange(conversationId: string, status: string, assignedAdmin?: { id: string; name: string }) {
    this.server.to(`conversation:${conversationId}`).emit(WS_EVENTS.STATUS_CHANGE, {
      conversationId,
      status,
      assignedAdmin,
    });
  }
}
