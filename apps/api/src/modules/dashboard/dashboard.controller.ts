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
import { DashboardService, WidgetType, WidgetConfig, CreateWidgetData } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ウィジェット作成
  @Post('widgets')
  async createWidget(@Body() body: CreateWidgetData) {
    return this.dashboardService.createWidget(body);
  }

  // ウィジェット一覧取得
  @Get('widgets')
  async getWidgets(@Query('defaultOnly') defaultOnly?: string) {
    return this.dashboardService.getWidgets(defaultOnly === 'true');
  }

  // ウィジェット詳細取得
  @Get('widgets/:id')
  async getWidget(@Param('id') id: string) {
    return this.dashboardService.getWidget(id);
  }

  // ウィジェット更新
  @Put('widgets/:id')
  async updateWidget(
    @Param('id') id: string,
    @Body() body: Partial<CreateWidgetData>,
  ) {
    return this.dashboardService.updateWidget(id, body);
  }

  // ウィジェット削除
  @Delete('widgets/:id')
  async deleteWidget(@Param('id') id: string) {
    return this.dashboardService.deleteWidget(id);
  }

  // ウィジェットデータ取得
  @Get('widgets/:id/data')
  async getWidgetData(@Param('id') id: string) {
    return this.dashboardService.getWidgetData(id);
  }

  // デフォルトウィジェット作成
  @Post('default')
  async createDefaultWidgets() {
    return this.dashboardService.createDefaultWidgets();
  }
}
