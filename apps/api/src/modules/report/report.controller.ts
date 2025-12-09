import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('summary')
  async getPeriodSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportService.getPeriodSummary(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('operators')
  async getOperatorReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportService.getOperatorReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('hourly')
  async getHourlyReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportService.getHourlyReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('daily-trend')
  async getDailyTrendReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportService.getDailyTrendReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post('generate')
  async generateReport(
    @Body()
    body: {
      type: 'daily' | 'weekly' | 'monthly';
      format: 'pdf' | 'csv' | 'json';
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.reportService.generateReport(
      body.type,
      body.format,
      body.startDate ? new Date(body.startDate) : undefined,
      body.endDate ? new Date(body.endDate) : undefined,
    );
  }

  @Get()
  async getReports(
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportService.getReports(type, limit ? parseInt(limit) : undefined);
  }

  @Post('schedule')
  async scheduleReport(
    @Body()
    body: {
      name: string;
      type: 'daily' | 'weekly' | 'monthly';
      format: 'pdf' | 'csv' | 'json';
      cronExpression: string;
      recipients?: string[];
    },
  ) {
    return this.reportService.scheduleReport(
      body.name,
      body.type,
      body.format,
      body.cronExpression,
      body.recipients,
    );
  }
}
