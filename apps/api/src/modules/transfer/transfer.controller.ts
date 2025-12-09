import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TransferService } from './transfer.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  // 転送リクエストを作成
  @Post()
  async requestTransfer(
    @Request() req: { user: { id: string } },
    @Body() body: { conversationId: string; toAdminId: string; reason?: string; note?: string },
  ) {
    return this.transferService.requestTransfer({
      conversationId: body.conversationId,
      fromAdminId: req.user.id,
      toAdminId: body.toAdminId,
      reason: body.reason,
      note: body.note,
    });
  }

  // 転送を承認
  @Post(':id/accept')
  async acceptTransfer(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.transferService.acceptTransfer(id, req.user.id);
  }

  // 転送を拒否
  @Post(':id/reject')
  async rejectTransfer(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.transferService.rejectTransfer(id, req.user.id, body?.reason);
  }

  // 転送をキャンセル
  @Post(':id/cancel')
  async cancelTransfer(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.transferService.cancelTransfer(id, req.user.id);
  }

  // 受信した転送リクエストを取得
  @Get('incoming')
  async getIncomingTransfers(@Request() req: { user: { id: string } }) {
    return this.transferService.getIncomingTransfers(req.user.id);
  }

  // 送信した転送リクエストを取得
  @Get('outgoing')
  async getOutgoingTransfers(@Request() req: { user: { id: string } }) {
    return this.transferService.getOutgoingTransfers(req.user.id);
  }

  // 会話の転送履歴を取得
  @Get('conversation/:conversationId')
  async getConversationTransferHistory(@Param('conversationId') conversationId: string) {
    return this.transferService.getConversationTransferHistory(conversationId);
  }

  // 転送可能なオペレーター一覧を取得
  @Get('operators')
  async getAvailableOperators(@Request() req: { user: { id: string } }) {
    return this.transferService.getAvailableOperators(req.user.id);
  }

  // 転送統計を取得
  @Get('stats')
  async getTransferStats(
    @Request() req: { user: { id: string } },
    @Query('adminId') adminId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.transferService.getTransferStats(
      adminId || req.user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
