import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationService } from '../notification/notification.service';

@ApiTags('settings')
@Controller('api/settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(
    private settingsService: SettingsService,
    private notificationService: NotificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: '全設定取得' })
  async getAll() {
    return this.settingsService.getAll();
  }

  @Get(':key')
  @ApiOperation({ summary: '設定取得' })
  async get(@Param('key') key: string, @Res() res: Response) {
    const value = await this.settingsService.get(key);
    // nullの場合でも有効なJSONレスポンスを返す
    res.json(value);
  }

  @Put(':key')
  @ApiOperation({ summary: '設定更新' })
  async set(@Param('key') key: string, @Body() body: { value: unknown }) {
    return this.settingsService.set(key, body.value);
  }

  @Put()
  @ApiOperation({ summary: '複数設定一括更新' })
  async setMultiple(@Body() body: Record<string, unknown>) {
    return this.settingsService.setMultiple(body);
  }
}
