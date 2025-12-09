import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('monitoring')
@Controller('api/monitoring')
export class MonitoringController {
  constructor(private monitoringService: MonitoringService) {}

  @Get('health')
  @ApiOperation({ summary: 'システムヘルスチェック' })
  async getHealth() {
    return this.monitoringService.getHealth();
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'システムメトリクス取得' })
  async getMetrics() {
    return this.monitoringService.getMetrics();
  }

  @Get('activity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '最近のアクティビティ' })
  async getRecentActivity(@Query('limit') limit?: string) {
    return this.monitoringService.getRecentActivity(
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('report/daily')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '日次レポート' })
  async getDailyReport(@Query('date') dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : undefined;
    return this.monitoringService.getDailyReport(date);
  }
}
