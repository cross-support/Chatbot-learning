import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('export')
@Controller('api/export')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Get('conversations')
  @ApiOperation({ summary: '会話履歴CSVエクスポート' })
  async exportConversations(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.exportService.exportConversations({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status,
    });

    this.sendCSV(res!, csv, 'conversations');
  }

  @Get('messages')
  @ApiOperation({ summary: 'メッセージCSVエクスポート' })
  async exportMessages(
    @Query('conversationId') conversationId?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.exportService.exportMessages(conversationId);
    this.sendCSV(res!, csv, 'messages');
  }

  @Get('users')
  @ApiOperation({ summary: 'ユーザー一覧CSVエクスポート' })
  async exportUsers(@Res() res: Response) {
    const csv = await this.exportService.exportUsers();
    this.sendCSV(res, csv, 'users');
  }

  @Get('inquiries')
  @ApiOperation({ summary: '時間外問い合わせCSVエクスポート' })
  async exportInquiries(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.exportService.exportInquiries({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status,
    });

    this.sendCSV(res!, csv, 'inquiries');
  }

  @Get('statistics')
  @ApiOperation({ summary: '統計データCSVエクスポート' })
  async exportStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportStatistics({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    this.sendCSV(res, csv, 'statistics');
  }

  private sendCSV(res: Response, csv: string, prefix: string) {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${prefix}-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
