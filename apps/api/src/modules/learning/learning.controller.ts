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
import { LearningService } from './learning.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Post('analyze')
  async analyzeQuestions() {
    return this.learningService.analyzeUnmatchedQuestions();
  }

  @Get('improvements')
  async getImprovements(@Query('status') status?: string) {
    return this.learningService.getImprovements(status);
  }

  @Post('improvements/:id/detail')
  async generateDetail(@Param('id') id: string) {
    return this.learningService.generateDetailedSuggestion(id);
  }

  @Put('improvements/:id')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected'; approvedBy?: string },
  ) {
    return this.learningService.updateImprovementStatus(
      id,
      body.status,
      body.approvedBy,
    );
  }

  @Get('stats')
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.learningService.getQuestionStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
