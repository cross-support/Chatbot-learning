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
import { AlertService } from './alert.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post()
  async createAlert(
    @Body()
    body: {
      name: string;
      type: string;
      condition: { threshold: number; operator: string };
      channels: string[];
      channelConfig?: Record<string, unknown>;
      cooldownMinutes?: number;
    },
  ) {
    return this.alertService.createAlert({
      ...body,
      condition: body.condition as { threshold: number; operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' },
    });
  }

  @Get()
  async getAlerts() {
    return this.alertService.getAlerts();
  }

  @Put(':id')
  async updateAlert(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.alertService.updateAlert(id, body);
  }

  @Delete(':id')
  async deleteAlert(@Param('id') id: string) {
    return this.alertService.deleteAlert(id);
  }

  @Get('history')
  async getAlertHistory(
    @Query('alertId') alertId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.alertService.getAlertHistory(
      alertId,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Post('check')
  async triggerAlertCheck() {
    await this.alertService.checkAlerts();
    return { success: true, message: 'Alert check completed' };
  }
}
