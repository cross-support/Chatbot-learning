import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SlaService, SlaPolicyData } from './sla.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('sla')
@UseGuards(JwtAuthGuard)
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  // ===== ポリシー管理 =====

  @Post('policies')
  async createPolicy(@Body() body: SlaPolicyData) {
    return this.slaService.createPolicy(body);
  }

  @Get('policies')
  async getPolicies(@Query('activeOnly') activeOnly?: string) {
    return this.slaService.getPolicies(activeOnly === 'true');
  }

  @Get('policies/:id')
  async getPolicy(@Param('id') id: string) {
    return this.slaService.getPolicy(id);
  }

  @Put('policies/:id')
  async updatePolicy(
    @Param('id') id: string,
    @Body() body: Partial<SlaPolicyData>,
  ) {
    return this.slaService.updatePolicy(id, body);
  }

  @Delete('policies/:id')
  async deletePolicy(@Param('id') id: string) {
    return this.slaService.deletePolicy(id);
  }

  // ===== SLA適用・トラッキング =====

  @Post('apply')
  async applyPolicy(@Body() body: { conversationId: string; policyId: string }) {
    return this.slaService.applyPolicyToConversation(body.conversationId, body.policyId);
  }

  @Post('first-response/:conversationId')
  async recordFirstResponse(@Param('conversationId') conversationId: string) {
    return this.slaService.recordFirstResponse(conversationId);
  }

  @Post('resolve/:conversationId')
  async recordResolution(@Param('conversationId') conversationId: string) {
    return this.slaService.recordResolution(conversationId);
  }

  @Get('conversation/:conversationId')
  async getConversationSla(@Param('conversationId') conversationId: string) {
    return this.slaService.getConversationSla(conversationId);
  }

  // ===== モニタリング =====

  @Get('breached')
  async getBreachedConversations() {
    return this.slaService.getBreachedConversations();
  }

  @Get('at-risk')
  async getAtRiskConversations(@Query('thresholdMinutes') thresholdMinutes?: string) {
    return this.slaService.getAtRiskConversations(
      thresholdMinutes ? parseInt(thresholdMinutes, 10) : undefined,
    );
  }

  // ===== 統計 =====

  @Get('stats')
  async getSlaStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.slaService.getSlaStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('stats/by-policy')
  async getStatsByPolicy(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.slaService.getStatsByPolicy(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
