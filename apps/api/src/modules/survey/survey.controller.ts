import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SurveyService } from './survey.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/surveys')
export class SurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  @Post()
  async submitSurvey(
    @Body()
    body: {
      conversationId: string;
      rating: number;
      feedback?: string;
      categories?: string[];
    },
  ) {
    return this.surveyService.submitSurvey(body);
  }

  @Get(':conversationId')
  async getSurvey(@Param('conversationId') conversationId: string) {
    return this.surveyService.getSurvey(conversationId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getRecentSurveys(@Query('limit') limit?: string) {
    return this.surveyService.getRecentSurveys(
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('statistics/summary')
  @UseGuards(JwtAuthGuard)
  async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.surveyService.getStatistics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('low-rating')
  @UseGuards(JwtAuthGuard)
  async getLowRatingSurveys(
    @Query('maxRating') maxRating?: string,
    @Query('limit') limit?: string,
  ) {
    return this.surveyService.getLowRatingSurveys(
      maxRating ? parseInt(maxRating, 10) : 2,
      limit ? parseInt(limit, 10) : 100,
    );
  }
}
