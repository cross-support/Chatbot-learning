import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
    return this.conversationService.findAll({
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('waiting/count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '待機中の会話数取得' })
  async getWaitingCount() {
    const count = await this.conversationService.getWaitingCount();
    return { count };
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
  async getMessages(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.messageService.findByConversation(id, { limit: limit ? Number(limit) : undefined });
  }

  @Post(':id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'メッセージ送信（管理者）' })
  async sendMessage(
    @Param('id') id: string,
    @Body() body: { content: string; contentType?: 'TEXT' | 'IMAGE'; payload?: Record<string, unknown> },
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
    const conversation = await this.conversationService.close(id);

    // WebSocketでステータス変更を通知
    await this.chatGateway.notifyStatusChange(id, 'CLOSED');

    return conversation;
  }
}
