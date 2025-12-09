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
import { CobrowseService } from './cobrowse.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('cobrowse')
export class CobrowseController {
  constructor(private readonly cobrowseService: CobrowseService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createSession(
    @Request() req: { user: { id: string } },
    @Body() body: { conversationId: string; userId: string },
  ) {
    return this.cobrowseService.createSession({
      conversationId: body.conversationId,
      adminId: req.user.id,
      userId: body.userId,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getSession(@Param('id') id: string) {
    return this.cobrowseService.getSession(id);
  }

  @Post('join/:sessionCode')
  async joinSession(@Param('sessionCode') sessionCode: string) {
    return this.cobrowseService.joinSession(sessionCode);
  }

  @Post(':id/end')
  @UseGuards(JwtAuthGuard)
  async endSession(@Param('id') id: string) {
    return this.cobrowseService.endSession(id);
  }

  @Get('conversation/:conversationId')
  @UseGuards(JwtAuthGuard)
  async getSessionsByConversation(@Param('conversationId') conversationId: string) {
    return this.cobrowseService.getSessionsByConversation(conversationId);
  }

  @Get('active/all')
  @UseGuards(JwtAuthGuard)
  async getActiveSessions() {
    return this.cobrowseService.getActiveSessions();
  }

  @Get(':id/signaling')
  async getSignalingInfo(@Param('id') id: string) {
    return this.cobrowseService.generateSignalingInfo(id);
  }

  @Get('stats/summary')
  @UseGuards(JwtAuthGuard)
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.cobrowseService.getSessionStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Post('cleanup')
  @UseGuards(JwtAuthGuard)
  async cleanup(@Body() body?: { expiryMinutes?: number }) {
    const count = await this.cobrowseService.cleanupExpiredSessions(body?.expiryMinutes);
    return { success: true, cleanedCount: count };
  }
}
