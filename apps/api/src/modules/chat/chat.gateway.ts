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
import { AiService } from '../ai/ai.service';
import { LmsService } from '../lms/lms.service';
import { PrismaService } from '../../prisma/prisma.service';

interface AutoResponse {
  id: string;
  delaySeconds: number;
  message: string;
}

interface JoinRoomData {
  sessionId: string;
  conversationId?: string;
  forceNewConversation?: boolean; // 新しい会話を強制的に作成
  userContext: {
    url: string;
    title: string;
    userAgent: string;
    lmsUser?: {
      id: string;
      name: string;
      email?: string;
      role?: 'learner' | 'group_admin' | 'global_admin'; // LMSユーザーのロール
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

interface FormSubmitData {
  conversationId: string;
  formId: string;
  formData: Record<string, unknown>;
  nodeId?: number;
  mailConfig?: {
    to?: string;
    subject: string;
    templateId?: string;
  };
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
  private autoResponseTimers = new Map<string, NodeJS.Timeout[]>(); // conversationId -> timers

  constructor(
    private chatService: ChatService,
    private conversationService: ConversationService,
    private messageService: MessageService,
    private scenarioService: ScenarioService,
    private notificationService: NotificationService,
    private aiService: AiService,
    private lmsService: LmsService,
    private prisma: PrismaService,
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
      let isNewConversation = false;

      // forceNewConversationがtrueの場合、既存の会話IDは無視して新規作成
      if (!data.forceNewConversation && data.conversationId) {
        conversation = await this.conversationService.findById(data.conversationId);
      }

      if (!conversation) {
        conversation = await this.conversationService.create(user.id, {
          url: data.userContext.url,
          title: data.userContext.title,
        });
        isNewConversation = true;
        this.logger.log(`[handleJoinRoom] New conversation created: ${conversation.id}`);
      }

      // ルームに参加
      await client.join(`conversation:${conversation.id}`);
      await client.join(`user:${user.id}`);

      // ユーザーのLMSロールを取得
      const userRole = data.userContext.lmsUser?.role || 'learner';

      // 初期シナリオを取得（ユーザーロールに応じてフィルタリング）
      const initialScenario = await this.scenarioService.getInitialOptions(userRole);

      // 旧形式との互換性のために message を追加
      const scenarioResponse = {
        ...initialScenario,
        message: initialScenario.messages?.map(m => m.text).join('\n\n') || '',
      };

      // 接続確認を送信
      client.emit(WS_EVENTS.CONNECTION_ACK, {
        userId: user.id,
        conversationId: conversation.id,
        status: conversation.status,
        scenario: scenarioResponse,
      });

      // 新規会話の場合、管理者に通知
      if (isNewConversation) {
        const conversationWithUser = await this.conversationService.findById(conversation.id);
        this.server.to('admin-room').emit(WS_EVENTS.CONVERSATION_UPDATED, {
          type: 'new_conversation',
          conversation: conversationWithUser,
          userName: user.name || 'ゲスト',
        });
        this.logger.log(`[handleJoinRoom] Notified admin-room about new conversation: ${conversation.id}`);
      }

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
    this.logger.log(`[handleSendMessage] Received send_message event: ${JSON.stringify(data)}`);
    try {
      // ユーザーメッセージを保存
      const message = await this.messageService.create({
        conversationId: data.conversationId,
        senderType: 'USER',
        contentType: data.contentType,
        content: data.content,
        payload: data.payload,
      });

      // 会話のステータスを取得
      const conversation = await this.conversationService.findById(data.conversationId);

      // 会話ルームにメッセージを配信
      this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.NEW_MESSAGE, message);

      // 管理者ルームにも通知（ユーザー名を含める）
      this.server.to('admin-room').emit(WS_EVENTS.NEW_MESSAGE, {
        ...message,
        userName: conversation?.user?.name,
      });

      // ユーザーからの最初のメッセージの場合、外部通知を送信
      if (conversation) {
        const messageCount = await this.messageService.countUserMessages(data.conversationId);
        if (messageCount === 1) {
          // 最初のユーザーメッセージなので通知を送信
          this.logger.log(`[handleSendMessage] First user message in conversation ${data.conversationId}, sending notification`);
          await this.notificationService.notifyNewRequest(conversation);
        }
      }

      this.logger.log(`Message sent in conversation ${data.conversationId}`);

      // BOTモードまたはWAITINGモードでテキストメッセージの場合、AI応答を生成
      if (conversation && (conversation.status === 'BOT' || conversation.status === 'WAITING') && data.contentType === 'TEXT') {
        // タイピングインジケーターを表示
        this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.TYPING_INDICATOR, {
          conversationId: data.conversationId,
          senderType: 'BOT',
          isTyping: true,
        });

        // 会話履歴を取得
        const previousMessages = await this.aiService.getConversationHistory(data.conversationId, 10);

        // AI応答を生成
        const aiResponse = await this.aiService.chat({
          conversationId: data.conversationId,
          userMessage: data.content,
          previousMessages,
          userInfo: {
            name: conversation.user?.name || undefined,
            email: conversation.user?.email || undefined,
            currentPage: (conversation.metadata as Record<string, unknown>)?.lastUrl as string || undefined,
          },
        });

        // タイピングインジケーターを非表示
        this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.TYPING_INDICATOR, {
          conversationId: data.conversationId,
          senderType: 'BOT',
          isTyping: false,
        });

        // AI応答をメッセージとして保存
        const botMessage = await this.messageService.create({
          conversationId: data.conversationId,
          senderType: 'BOT',
          contentType: 'TEXT',
          content: aiResponse.reply,
        });

        // AI応答を配信
        this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.NEW_MESSAGE, botMessage);
        this.server.to('admin-room').emit(WS_EVENTS.NEW_MESSAGE, botMessage);

        // エスカレーションが必要な場合
        if (aiResponse.needsEscalation) {
          const updatedConversation = await this.conversationService.updateStatus(data.conversationId, 'WAITING');

          // ステータス変更を通知
          this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.STATUS_CHANGE, {
            conversationId: data.conversationId,
            status: 'WAITING',
          });

          // 管理者に通知
          this.server.to('admin-room').emit(WS_EVENTS.NEW_REQUEST, {
            conversation: updatedConversation,
            escalationReason: aiResponse.escalationReason,
          });

          // 外部通知（Slack等）
          await this.notificationService.notifyNewRequest(updatedConversation);

          // 自動応答タイマーを開始
          await this.startAutoResponseTimers(data.conversationId);

          this.logger.log(`Escalation triggered for conversation ${data.conversationId}: ${aiResponse.escalationReason}`);
        }
      }
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
    this.logger.log(`[handleSelectOption] Received: ${JSON.stringify(data)}`);
    try {
      // シナリオ処理
      const response = await this.scenarioService.processSelection(data.conversationId, data.nodeId);
      this.logger.log(`[handleSelectOption] ScenarioResponse: messages=${response.messages?.length}, options=${response.options?.length}, action=${response.action}`);

      // シナリオ応答を送信（nodeIdを含める）
      client.emit(WS_EVENTS.SCENARIO_RESPONSE, {
        ...response,
        nodeId: data.nodeId,
      });

      // HANDOVERアクションの場合
      if (response.action === 'HANDOVER') {
        const conversation = await this.conversationService.updateStatus(data.conversationId, 'WAITING');

        // オペレーター待機メッセージを送信
        const waitingMessage = await this.messageService.create({
          conversationId: data.conversationId,
          senderType: 'BOT',
          contentType: 'TEXT',
          content: '営業時間中であれば、オペレーターからの回答をお待ちください。\n（混み具合によっては返信までお時間をいただく場合がございます）',
        });

        this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.NEW_MESSAGE, waitingMessage);
        this.server.to('admin-room').emit(WS_EVENTS.NEW_MESSAGE, waitingMessage);

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

        // 自動応答タイマーを開始
        await this.startAutoResponseTimers(data.conversationId);
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

  @SubscribeMessage(WS_EVENTS.MARK_READ)
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; senderType: 'USER' | 'ADMIN' },
  ) {
    try {
      this.logger.log(`[MARK_READ] Received from ${data.senderType} for conversation ${data.conversationId}`);

      // 既読としてマーク（senderTypeの逆側のメッセージを既読にする）
      const readBy = data.senderType;

      if (data.senderType === 'ADMIN') {
        // 管理者がユーザーのメッセージを既読にする
        await this.messageService.markAsRead(data.conversationId, 'USER');
        this.logger.log(`[MARK_READ] Marked USER messages as read`);
      } else {
        // ユーザーが管理者とBOTのメッセージを既読にする
        await this.messageService.markAsRead(data.conversationId, 'ADMIN');
        await this.messageService.markAsRead(data.conversationId, 'BOT');
        this.logger.log(`[MARK_READ] Marked ADMIN and BOT messages as read`);
      }

      // 既読通知を送信
      this.logger.log(`[MARK_READ] Emitting ALL_MESSAGES_READ to conversation:${data.conversationId} with readBy=${readBy}`);
      this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.ALL_MESSAGES_READ, {
        conversationId: data.conversationId,
        readBy,
      });

      this.logger.log(`Messages marked as read in conversation ${data.conversationId} by ${readBy}`);
    } catch (error) {
      this.logger.error('Mark read error:', error);
    }
  }

  @SubscribeMessage(WS_EVENTS.USER_CLOSE_CHAT)
  async handleUserCloseChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      this.logger.log(`[USER_CLOSE_CHAT] User closing conversation ${data.conversationId}`);

      // 終了メッセージを追加
      const closedMessage = await this.messageService.create({
        conversationId: data.conversationId,
        senderType: 'SYSTEM',
        contentType: 'TEXT',
        content: 'チャットを終了しました。ご利用ありがとうございました。',
      });

      // メッセージを配信
      this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.NEW_MESSAGE, closedMessage);
      this.server.to('admin-room').emit(WS_EVENTS.NEW_MESSAGE, closedMessage);

      // 会話ステータスをCLOSEDに更新
      await this.conversationService.updateStatus(data.conversationId, 'CLOSED');

      // ステータス変更を通知
      this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.STATUS_CHANGE, {
        conversationId: data.conversationId,
        status: 'CLOSED',
      });

      // 管理者にも通知
      this.server.to('admin-room').emit(WS_EVENTS.CONVERSATION_UPDATED, {
        conversationId: data.conversationId,
        status: 'CLOSED',
      });

      this.logger.log(`[USER_CLOSE_CHAT] Conversation ${data.conversationId} closed by user`);
    } catch (error) {
      this.logger.error('User close chat error:', error);
      client.emit(WS_EVENTS.ERROR, { message: 'チャット終了に失敗しました' });
    }
  }

  @SubscribeMessage('join_admin_room')
  async handleJoinAdminRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { adminId: string; conversationId?: string },
  ) {
    await client.join('admin-room');
    this.logger.log(`[join_admin_room] Admin ${data.adminId} joined admin-room (socket: ${client.id})`);

    // 特定の会話ルームにも参加
    if (data.conversationId) {
      await client.join(`conversation:${data.conversationId}`);
      this.logger.log(`[join_admin_room] Admin ${data.adminId} joined conversation:${data.conversationId} (socket: ${client.id})`);
    }

    if (!this.adminSockets.has(data.adminId)) {
      this.adminSockets.set(data.adminId, new Set());
    }
    this.adminSockets.get(data.adminId)?.add(client.id);
  }

  // 管理者からユーザーへのメッセージ送信
  async sendAdminMessage(conversationId: string, adminId: string, content: string, contentType: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT', payload?: Record<string, unknown>) {
    const message = await this.messageService.create({
      conversationId,
      senderType: 'ADMIN',
      contentType,
      content,
      payload,
    });

    this.logger.log(`Sending admin message to conversation:${conversationId} - ${content}`);
    this.server.to(`conversation:${conversationId}`).emit(WS_EVENTS.NEW_MESSAGE, message);
    this.logger.log(`Admin message sent to conversation:${conversationId}`);
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

  // 特定メッセージの既読通知
  async notifyMessagesRead(conversationId: string, messageIds: string[]) {
    this.server.to(`conversation:${conversationId}`).emit(WS_EVENTS.MESSAGES_READ, {
      conversationId,
      messageIds,
    });
  }

  // 全メッセージ既読通知
  async notifyAllMessagesRead(conversationId: string) {
    this.server.to(`conversation:${conversationId}`).emit(WS_EVENTS.ALL_MESSAGES_READ, {
      conversationId,
    });
  }

  // フォーム送信処理
  @SubscribeMessage('form_submit')
  async handleFormSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: FormSubmitData,
  ) {
    try {
      this.logger.log(`[handleFormSubmit] Form submitted: formId=${data.formId}, conversationId=${data.conversationId}`);

      // 会話情報を取得
      const conversation = await this.conversationService.findById(data.conversationId);
      if (!conversation) {
        throw new Error('会話が見つかりません');
      }

      // フォーム送信内容をメッセージとして保存
      const formSummary = Object.entries(data.formData)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      const userMessage = await this.messageService.create({
        conversationId: data.conversationId,
        senderType: 'USER',
        contentType: 'TEXT',
        content: `【フォーム送信: ${data.formId}】\n${formSummary}`,
        payload: {
          formId: data.formId,
          formData: data.formData,
        },
      });

      // メッセージを配信
      this.server.to(`conversation:${data.conversationId}`).emit(WS_EVENTS.NEW_MESSAGE, userMessage);
      this.server.to('admin-room').emit(WS_EVENTS.NEW_MESSAGE, {
        ...userMessage,
        userName: conversation.user?.name,
      });

      // メール送信設定がある場合
      if (data.mailConfig) {
        const mailResult = await this.notificationService.sendScenarioMail({
          to: data.mailConfig.to,
          toUser: conversation.user ? {
            name: conversation.user.name || undefined,
            email: conversation.user.email || undefined,
          } : undefined,
          subject: data.mailConfig.subject,
          body: formSummary,
          templateId: data.mailConfig.templateId,
          conversationId: data.conversationId,
          formData: data.formData,
        });

        if (!mailResult.success) {
          this.logger.error(`[handleFormSubmit] Mail send failed: ${mailResult.error}`);
        } else {
          this.logger.log(`[handleFormSubmit] Mail sent successfully`);
        }
      }

      // Chatwork通知を送信（営業時間外または常に）
      await this.notificationService.notifyChatworkFormSubmit({
        formId: data.formId,
        formData: data.formData,
        userName: conversation.user?.name || undefined,
        userEmail: conversation.user?.email || undefined,
        conversationId: data.conversationId,
      });

      // フォーム送信完了を通知
      client.emit('form_submit_result', {
        success: true,
        formId: data.formId,
        conversationId: data.conversationId,
      });

      // 次のノードがある場合は遷移
      if (data.nodeId) {
        const response = await this.scenarioService.processSelection(data.conversationId, data.nodeId);
        client.emit(WS_EVENTS.SCENARIO_RESPONSE, {
          ...response,
          nodeId: data.nodeId,
        });
      }

      this.logger.log(`[handleFormSubmit] Form ${data.formId} processed successfully`);
    } catch (error) {
      this.logger.error('Form submit error:', error);
      client.emit('form_submit_result', {
        success: false,
        error: 'フォーム送信に失敗しました',
        formId: data.formId,
      });
    }
  }

  // MAILアクション処理（シナリオから直接呼び出し）
  @SubscribeMessage('send_scenario_mail')
  async handleSendScenarioMail(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      conversationId: string;
      config: {
        to?: string;
        subject: string;
        body: string;
        templateId?: string;
      };
      nextNodeId?: number;
    },
  ) {
    try {
      this.logger.log(`[handleSendScenarioMail] Sending mail for conversation ${data.conversationId}`);

      const conversation = await this.conversationService.findById(data.conversationId);

      const mailResult = await this.notificationService.sendScenarioMail({
        to: data.config.to,
        toUser: conversation?.user ? {
          name: conversation.user.name || undefined,
          email: conversation.user.email || undefined,
        } : undefined,
        subject: data.config.subject,
        body: data.config.body,
        templateId: data.config.templateId,
        conversationId: data.conversationId,
      });

      client.emit('mail_send_result', {
        success: mailResult.success,
        error: mailResult.error,
        conversationId: data.conversationId,
      });

      // 次のノードがある場合は遷移
      if (data.nextNodeId && mailResult.success) {
        const response = await this.scenarioService.processSelection(data.conversationId, data.nextNodeId);
        client.emit(WS_EVENTS.SCENARIO_RESPONSE, {
          ...response,
          nodeId: data.nextNodeId,
        });
      }

      this.logger.log(`[handleSendScenarioMail] Mail ${mailResult.success ? 'sent' : 'failed'}`);
    } catch (error) {
      this.logger.error('Send scenario mail error:', error);
      client.emit('mail_send_result', {
        success: false,
        error: 'メール送信に失敗しました',
      });
    }
  }

  // LMSイベント処理
  @SubscribeMessage('lms_event')
  async handleLmsEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      lmsUserId: string;
      eventType: 'course_start' | 'lesson_complete' | 'course_complete' | 'quiz_submit' | 'help_request';
      courseId?: string;
      lessonId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    try {
      this.logger.log(`[handleLmsEvent] LMS event: ${data.eventType} from ${data.lmsUserId}`);

      // LMSイベントをログに記録
      await this.lmsService.logLmsEvent(data);

      // ヘルプリクエストの場合は特別処理
      if (data.eventType === 'help_request') {
        // LMSユーザーに紐づくユーザーを検索
        const user = await this.lmsService.findUserByLmsId(data.lmsUserId);
        if (user && user.conversations.length > 0) {
          // 最新の会話に通知
          const latestConversation = user.conversations[0];
          const helpMessage = await this.messageService.create({
            conversationId: latestConversation.id,
            senderType: 'SYSTEM',
            contentType: 'TEXT',
            content: `LMSからヘルプリクエストがありました。\nコース: ${data.courseId || '不明'}\nレッスン: ${data.lessonId || '不明'}`,
          });

          this.server.to(`conversation:${latestConversation.id}`).emit(WS_EVENTS.NEW_MESSAGE, helpMessage);
          this.server.to('admin-room').emit(WS_EVENTS.NEW_MESSAGE, {
            ...helpMessage,
            userName: user.name,
          });
        }
      }

      client.emit('lms_event_result', {
        success: true,
        eventType: data.eventType,
      });

      this.logger.log(`[handleLmsEvent] LMS event processed: ${data.eventType}`);
    } catch (error) {
      this.logger.error('LMS event error:', error);
      client.emit('lms_event_result', {
        success: false,
        error: 'LMSイベントの処理に失敗しました',
      });
    }
  }

  // LMSユーザー進捗取得
  @SubscribeMessage('get_lms_progress')
  async handleGetLmsProgress(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    try {
      const progress = await this.lmsService.getUserLmsProgress(data.userId);
      client.emit('lms_progress_result', {
        success: true,
        progress,
      });
    } catch (error) {
      this.logger.error('Get LMS progress error:', error);
      client.emit('lms_progress_result', {
        success: false,
        error: 'LMS進捗の取得に失敗しました',
      });
    }
  }

  // CSVエクスポート処理
  @SubscribeMessage('export_csv')
  async handleExportCsv(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      conversationId: string;
      type: 'conversation' | 'form';
      formId?: string;
      formData?: Record<string, unknown>[];
    },
  ) {
    try {
      this.logger.log(`[handleExportCsv] Export CSV: type=${data.type}, conversationId=${data.conversationId}`);

      let result: { csv: string; filename: string };

      if (data.type === 'conversation') {
        // 会話履歴をCSVエクスポート
        result = await this.notificationService.exportConversationToCsv(data.conversationId);
      } else if (data.type === 'form' && data.formData && data.formId) {
        // フォームデータをCSVエクスポート
        result = this.notificationService.exportFormDataToCsv(data.formData, data.formId);
      } else {
        throw new Error('無効なエクスポートタイプです');
      }

      client.emit('csv_export_result', {
        success: true,
        csv: result.csv,
        filename: result.filename,
        conversationId: data.conversationId,
      });

      this.logger.log(`[handleExportCsv] CSV exported: ${result.filename}`);
    } catch (error) {
      this.logger.error('CSV export error:', error);
      client.emit('csv_export_result', {
        success: false,
        error: 'CSVエクスポートに失敗しました',
      });
    }
  }

  /**
   * 自動応答タイマーを開始
   */
  private async startAutoResponseTimers(conversationId: string): Promise<void> {
    // 既存のタイマーをクリア
    this.clearAutoResponseTimers(conversationId);

    try {
      // 自動応答設定を取得
      const settings = await this.prisma.chatSettings.findFirst({
        where: { key: 'chat_settings' },
      });

      if (!settings || !settings.value) {
        return;
      }

      const chatSettings = settings.value as Record<string, unknown>;
      const autoResponses = chatSettings.autoResponses as AutoResponse[] | undefined;

      if (!autoResponses || autoResponses.length === 0) {
        return;
      }

      const timers: NodeJS.Timeout[] = [];

      for (const autoResponse of autoResponses) {
        const timer = setTimeout(async () => {
          try {
            // 会話の現在の状態を確認
            const conversation = await this.conversationService.findById(conversationId);
            if (!conversation) {
              return;
            }

            // WAITINGステータスの場合のみ自動応答を送信（オペレーターがまだ対応していない）
            if (conversation.status !== 'WAITING') {
              this.logger.log(`[AutoResponse] Skipped - conversation ${conversationId} is not in WAITING status (current: ${conversation.status})`);
              return;
            }

            // 最後のメッセージが管理者/BOTからでないか確認
            const messages = await this.messageService.findByConversation(conversationId, { limit: 1 });
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && (lastMessage.senderType === 'ADMIN' || lastMessage.senderType === 'BOT')) {
              this.logger.log(`[AutoResponse] Skipped - last message is from ${lastMessage.senderType}`);
              return;
            }

            // 自動応答メッセージを送信
            const botMessage = await this.messageService.create({
              conversationId,
              senderType: 'BOT',
              contentType: 'TEXT',
              content: autoResponse.message,
            });

            this.server.to(`conversation:${conversationId}`).emit(WS_EVENTS.NEW_MESSAGE, botMessage);
            this.server.to('admin-room').emit(WS_EVENTS.NEW_MESSAGE, botMessage);

            this.logger.log(`[AutoResponse] Sent auto-response to conversation ${conversationId}: "${autoResponse.message.substring(0, 50)}..."`);
          } catch (error) {
            this.logger.error(`[AutoResponse] Error sending auto-response:`, error);
          }
        }, autoResponse.delaySeconds * 1000);

        timers.push(timer);
      }

      this.autoResponseTimers.set(conversationId, timers);
      this.logger.log(`[AutoResponse] Started ${timers.length} timer(s) for conversation ${conversationId}`);
    } catch (error) {
      this.logger.error(`[AutoResponse] Error starting timers:`, error);
    }
  }

  /**
   * 自動応答タイマーをクリア
   */
  private clearAutoResponseTimers(conversationId: string): void {
    const timers = this.autoResponseTimers.get(conversationId);
    if (timers) {
      timers.forEach(timer => clearTimeout(timer));
      this.autoResponseTimers.delete(conversationId);
      this.logger.log(`[AutoResponse] Cleared timers for conversation ${conversationId}`);
    }
  }
}
