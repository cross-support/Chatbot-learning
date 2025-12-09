import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { ConversationStatus } from '@prisma/client';

@ApiTags('conversations')
@Controller('api/conversations')
export class ChatController {
  constructor(
    private conversationService: ConversationService,
    private messageService: MessageService,
    private chatGateway: ChatGateway,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '会話一覧取得' })
  @ApiQuery({ name: 'status', required: false, enum: ['BOT', 'WAITING', 'HUMAN', 'CLOSED'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findAll(
    @Query('status') status?: ConversationStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    console.log('[ChatController.findAll] Called with:', { status, limit, offset });
    const result = await this.conversationService.findAll({
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    console.log('[ChatController.findAll] Returning:', result.total, 'conversations');
    return result;
  }

  @Get('waiting/count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '待機中の会話数取得' })
  async getWaitingCount() {
    const count = await this.conversationService.getWaitingCount();
    return { count };
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '会話統計情報取得' })
  @ApiQuery({ name: 'period', required: false, enum: ['today', 'week', 'month'] })
  async getStatistics(@Query('period') period?: 'today' | 'week' | 'month') {
    return this.conversationService.getStatistics(period || 'today');
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '会話詳細取得' })
  async findById(@Param('id') id: string) {
    return this.conversationService.findById(id);
  }

  @Get(':id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'メッセージ一覧取得' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false, type: String, description: 'このIDより前のメッセージを取得' })
  async getMessages(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ) {
    return this.messageService.findByConversation(id, {
      limit: limit ? Number(limit) : undefined,
      beforeId: before,
    });
  }

  @Post(':id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'メッセージ送信（管理者）' })
  async sendMessage(
    @Param('id') id: string,
    @Body() body: { content: string; contentType?: 'TEXT' | 'IMAGE' | 'FILE'; payload?: Record<string, unknown> },
    @Req() req: RequestWithUser,
  ) {
    return this.chatGateway.sendAdminMessage(
      id,
      req.user.id,
      body.content,
      body.contentType || 'TEXT',
      body.payload,
    );
  }

  @Post(':id/assign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '担当者アサイン' })
  async assign(@Param('id') id: string, @Req() req: RequestWithUser) {
    const conversation = await this.conversationService.assignAdmin(id, req.user.id);

    // 対応開始メッセージを追加
    const startMessage = await this.messageService.create({
      conversationId: id,
      senderType: 'SYSTEM',
      contentType: 'TEXT',
      content: 'オペレーターがチャットを開始しました。',
    });

    // WebSocketで開始メッセージを送信
    this.chatGateway.server.to(`conversation:${id}`).emit('new_message', startMessage);
    this.chatGateway.server.to('admin-room').emit('new_message', startMessage);

    // WebSocketでステータス変更を通知
    await this.chatGateway.notifyStatusChange(id, 'HUMAN', {
      id: req.user.id,
      name: req.user.name,
    });

    return conversation;
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ステータス変更' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ConversationStatus },
  ) {
    const conversation = await this.conversationService.updateStatus(id, body.status);

    // WebSocketでステータス変更を通知
    await this.chatGateway.notifyStatusChange(id, body.status);

    return conversation;
  }

  @Post(':id/close')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '会話終了' })
  async close(@Param('id') id: string) {
    // 終了メッセージを追加
    const closedMessage = await this.messageService.create({
      conversationId: id,
      senderType: 'SYSTEM',
      contentType: 'TEXT',
      content: 'チャットを終了しました。ご利用ありがとうございました。',
    });

    // WebSocketで終了メッセージを送信
    this.chatGateway.server.to(`conversation:${id}`).emit('new_message', closedMessage);
    this.chatGateway.server.to('admin-room').emit('new_message', closedMessage);

    const conversation = await this.conversationService.close(id);

    // WebSocketでステータス変更を通知
    await this.chatGateway.notifyStatusChange(id, 'CLOSED');

    return conversation;
  }

  @Post(':id/messages/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'メッセージ既読' })
  async markAsRead(
    @Param('id') id: string,
    @Body() body: { messageIds: string[] },
  ) {
    await this.messageService.markAsRead(body.messageIds);

    // WebSocketで既読状態を通知
    await this.chatGateway.notifyMessagesRead(id, body.messageIds);

    return { success: true };
  }

  @Post(':id/messages/read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '全メッセージ既読' })
  async markAllAsRead(@Param('id') id: string) {
    await this.messageService.markAllAsRead(id);

    // WebSocketで既読状態を通知
    await this.chatGateway.notifyAllMessagesRead(id);

    return { success: true };
  }

  @Get(':id/messages/unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '未読メッセージ数取得' })
  async getUnreadCount(@Param('id') id: string) {
    // ユーザーからのメッセージの未読数を返す
    const count = await this.messageService.getUnreadCount(id, 'USER');
    return { count };
  }

  @Post(':id/star')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'スター切り替え' })
  async toggleStar(@Param('id') id: string) {
    return this.conversationService.toggleStar(id);
  }

  @Post(':id/memo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '内部メモ追加' })
  async addInternalMemo(
    @Param('id') id: string,
    @Body() body: { content: string },
    @Req() req: RequestWithUser,
  ) {
    // 内部メモを作成（INTERNAL_MEMOタイプでユーザーには表示されない）
    const memo = await this.messageService.create({
      conversationId: id,
      senderType: 'ADMIN',
      contentType: 'INTERNAL_MEMO',
      content: body.content,
      payload: {
        authorId: req.user.id,
        authorName: req.user.name,
      },
    });

    // 管理者ルームにのみ通知（ユーザーには送信しない）
    this.chatGateway.server.to('admin-room').emit('new_message', memo);

    return memo;
  }

  @Get(':id/memos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '内部メモ一覧取得' })
  async getInternalMemos(@Param('id') id: string) {
    return this.messageService.findInternalMemos(id);
  }

  @Get(':id/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '会話エクスポート' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'], description: 'エクスポート形式（デフォルト: json）' })
  async exportConversation(
    @Param('id') id: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const exportFormat = format || 'json';
    const conversation = await this.conversationService.findById(id);
    if (!conversation) {
      return res.status(404).json({ error: '会話が見つかりません' });
    }

    const messages = await this.messageService.findByConversation(id, { limit: 10000 });

    const exportData = {
      conversation: {
        id: conversation.id,
        status: conversation.status,
        createdAt: conversation.createdAt,
        closedAt: conversation.closedAt,
        user: conversation.user ? {
          id: conversation.user.id,
          name: conversation.user.name,
          email: conversation.user.email,
        } : null,
        assignedAdmin: conversation.admin ? {
          id: conversation.admin.id,
          name: conversation.admin.name,
        } : null,
      },
      messages: messages.map((msg: { id: string; senderType: string; contentType: string; content: string; createdAt: Date; isRead: boolean }) => ({
        id: msg.id,
        senderType: msg.senderType,
        contentType: msg.contentType,
        content: msg.content,
        createdAt: msg.createdAt,
        isRead: msg.isRead,
      })),
      exportedAt: new Date().toISOString(),
    };

    if (exportFormat === 'csv') {
      // CSV形式でエクスポート
      const csvRows: string[] = [];
      csvRows.push('時刻,送信者,メッセージ種別,内容');

      for (const msg of exportData.messages) {
        const time = new Date(msg.createdAt).toLocaleString('ja-JP');
        const sender = msg.senderType === 'USER' ? 'ユーザー' :
                       msg.senderType === 'ADMIN' ? '管理者' :
                       msg.senderType === 'BOT' ? 'BOT' : 'システム';
        const contentType = msg.contentType === 'IMAGE' ? '画像' :
                           msg.contentType === 'FILE' ? 'ファイル' : 'テキスト';
        // CSVエスケープ
        const escapedContent = `"${msg.content.replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
        csvRows.push(`${time},${sender},${contentType},${escapedContent}`);
      }

      // BOMを追加してExcelで文字化けしないように
      const bom = '\uFEFF';
      const csvContent = bom + csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="conversation_${id}_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvContent);
    }

    // JSON形式でエクスポート
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="conversation_${id}_${new Date().toISOString().split('T')[0]}.json"`);
    return res.json(exportData);
  }

  @Get('export/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '全会話エクスポート' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  @ApiQuery({ name: 'status', required: false, enum: ['BOT', 'WAITING', 'HUMAN', 'CLOSED'] })
  @ApiQuery({ name: 'from', required: false, type: String, description: '開始日（YYYY-MM-DD）' })
  @ApiQuery({ name: 'to', required: false, type: String, description: '終了日（YYYY-MM-DD）' })
  async exportAllConversations(
    @Query('format') format: string,
    @Query('status') status: ConversationStatus | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const exportFormat = format || 'json';
    const result = await this.conversationService.findAll({
      status,
      limit: 10000,
    });

    // 日付フィルタリング
    let filteredConversations = result.conversations;
    if (from) {
      const fromDate = new Date(from);
      filteredConversations = filteredConversations.filter(
        (c) => new Date(c.createdAt) >= fromDate
      );
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      filteredConversations = filteredConversations.filter(
        (c) => new Date(c.createdAt) <= toDate
      );
    }

    if (exportFormat === 'csv') {
      const csvRows: string[] = [];
      csvRows.push('会話ID,ユーザー名,ステータス,開始日時,終了日時,メッセージ数');

      for (const conv of filteredConversations) {
        const messages = await this.messageService.findByConversation(conv.id, { limit: 10000 });
        const userName = conv.user?.name || '不明';
        const startTime = new Date(conv.createdAt).toLocaleString('ja-JP');
        const endTime = conv.closedAt ? new Date(conv.closedAt).toLocaleString('ja-JP') : '-';
        csvRows.push(`${conv.id},"${userName}",${conv.status},${startTime},${endTime},${messages.length}`);
      }

      const bom = '\uFEFF';
      const csvContent = bom + csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="conversations_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvContent);
    }

    // JSON形式
    const exportData = {
      conversations: filteredConversations.map((conv) => ({
        id: conv.id,
        status: conv.status,
        createdAt: conv.createdAt,
        closedAt: conv.closedAt,
        user: conv.user ? {
          id: conv.user.id,
          name: conv.user.name,
          email: conv.user.email,
        } : null,
      })),
      total: filteredConversations.length,
      exportedAt: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="conversations_${new Date().toISOString().split('T')[0]}.json"`);
    return res.json(exportData);
  }
}
