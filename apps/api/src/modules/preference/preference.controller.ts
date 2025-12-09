import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PreferenceService } from './preference.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('preferences')
@UseGuards(JwtAuthGuard)
export class PreferenceController {
  constructor(private readonly preferenceService: PreferenceService) {}

  @Get()
  async getPreference(@Request() req: { user: { id: string } }) {
    return this.preferenceService.getPreference(req.user.id);
  }

  @Put('theme')
  async updateTheme(
    @Request() req: { user: { id: string } },
    @Body() body: { theme: 'light' | 'dark' | 'system' },
  ) {
    return this.preferenceService.updateTheme(req.user.id, body.theme);
  }

  @Put('locale')
  async updateLocale(
    @Request() req: { user: { id: string } },
    @Body() body: { locale: string },
  ) {
    return this.preferenceService.updateLocale(req.user.id, body.locale);
  }

  @Put('shortcuts')
  async updateShortcuts(
    @Request() req: { user: { id: string } },
    @Body() body: { shortcuts: Record<string, string> },
  ) {
    return this.preferenceService.updateShortcuts(req.user.id, body.shortcuts);
  }

  @Put('dashboard-layout')
  async updateDashboardLayout(
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      layout: {
        widgets: Array<{ id: string; x: number; y: number; w: number; h: number }>;
      };
    },
  ) {
    return this.preferenceService.updateDashboardLayout(req.user.id, body.layout);
  }

  @Put('notifications')
  async updateNotifications(
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      sound?: boolean;
      desktop?: boolean;
      email?: boolean;
      newConversation?: boolean;
      newMessage?: boolean;
      transfer?: boolean;
    },
  ) {
    return this.preferenceService.updateNotifications(req.user.id, body);
  }

  @Post('reset')
  async resetPreference(@Request() req: { user: { id: string } }) {
    return this.preferenceService.resetPreference(req.user.id);
  }
}
