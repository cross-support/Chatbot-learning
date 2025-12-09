import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InsightService } from './insight.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/insights')
@UseGuards(JwtAuthGuard)
export class InsightController {
  constructor(private readonly insightService: InsightService) {}

  @Post('analyze/:conversationId')
  async analyzeConversation(@Param('conversationId') conversationId: string) {
    return this.insightService.analyzeConversation(conversationId);
  }

  @Get('conversation/:conversationId')
  async getInsight(@Param('conversationId') conversationId: string) {
    return this.insightService.getInsight(conversationId);
  }

  @Get('quality/:conversationId')
  async getQualityScore(@Param('conversationId') conversationId: string) {
    return this.insightService.calculateQualityScore(conversationId);
  }

  @Get('sentiment-trend')
  async getSentimentTrend(@Query('days') days?: string) {
    return this.insightService.getSentimentTrend(days ? parseInt(days, 10) : 7);
  }

  @Get('sentiment-stats')
  async getSentimentStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.insightService.getSentimentStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('topics')
  async getTopicAnalysis(@Query('limit') limit?: string) {
    return this.insightService.getTopicAnalysis(
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('faq/extract')
  async extractFAQ() {
    return this.insightService.updateFAQSuggestions();
  }

  @Get('faq')
  async getFAQSuggestions(@Query('approved') approved?: string) {
    return this.insightService.getFAQSuggestions(approved === 'true');
  }

  @Put('faq/:id')
  async updateFAQSuggestion(
    @Param('id') id: string,
    @Body() body: { isApproved?: boolean; answer?: string },
  ) {
    return this.insightService.updateFAQSuggestion(id, body);
  }
}
