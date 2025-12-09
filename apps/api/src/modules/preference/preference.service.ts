import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface ShortcutConfig {
  [action: string]: string; // action -> key combination
}

interface DashboardLayout {
  widgets: Array<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
}

interface NotificationSettings {
  sound: boolean;
  desktop: boolean;
  email: boolean;
  newConversation: boolean;
  newMessage: boolean;
  transfer: boolean;
}

@Injectable()
export class PreferenceService {
  private readonly logger = new Logger(PreferenceService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 管理者設定を取得
   */
  async getPreference(adminId: string) {
    let preference = await this.prisma.adminPreference.findUnique({
      where: { adminId },
    });

    if (!preference) {
      preference = await this.createDefaultPreference(adminId);
    }

    return preference;
  }

  /**
   * デフォルト設定を作成
   */
  private async createDefaultPreference(adminId: string) {
    return this.prisma.adminPreference.create({
      data: {
        adminId,
        theme: 'light',
        locale: 'ja',
        shortcuts: this.getDefaultShortcuts() as unknown as Prisma.InputJsonValue,
        dashboardLayout: this.getDefaultDashboardLayout() as unknown as Prisma.InputJsonValue,
        notifications: this.getDefaultNotifications() as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * テーマを更新
   */
  async updateTheme(adminId: string, theme: 'light' | 'dark' | 'system') {
    return this.prisma.adminPreference.upsert({
      where: { adminId },
      create: {
        adminId,
        theme,
      },
      update: { theme },
    });
  }

  /**
   * ロケールを更新
   */
  async updateLocale(adminId: string, locale: string) {
    return this.prisma.adminPreference.upsert({
      where: { adminId },
      create: {
        adminId,
        locale,
      },
      update: { locale },
    });
  }

  /**
   * ショートカット設定を更新
   */
  async updateShortcuts(adminId: string, shortcuts: ShortcutConfig) {
    return this.prisma.adminPreference.upsert({
      where: { adminId },
      create: {
        adminId,
        shortcuts: shortcuts as unknown as Prisma.InputJsonValue,
      },
      update: { shortcuts: shortcuts as unknown as Prisma.InputJsonValue },
    });
  }

  /**
   * ダッシュボードレイアウトを更新
   */
  async updateDashboardLayout(adminId: string, layout: DashboardLayout) {
    return this.prisma.adminPreference.upsert({
      where: { adminId },
      create: {
        adminId,
        dashboardLayout: layout as unknown as Prisma.InputJsonValue,
      },
      update: { dashboardLayout: layout as unknown as Prisma.InputJsonValue },
    });
  }

  /**
   * 通知設定を更新
   */
  async updateNotifications(adminId: string, notifications: Partial<NotificationSettings>) {
    const current = await this.getPreference(adminId);
    const merged = {
      ...(current.notifications as unknown as NotificationSettings || this.getDefaultNotifications()),
      ...notifications,
    };

    return this.prisma.adminPreference.update({
      where: { adminId },
      data: { notifications: merged as unknown as Prisma.InputJsonValue },
    });
  }

  /**
   * 設定をリセット
   */
  async resetPreference(adminId: string) {
    await this.prisma.adminPreference.deleteMany({
      where: { adminId },
    });
    return this.createDefaultPreference(adminId);
  }

  // ===== デフォルト設定 =====

  private getDefaultShortcuts(): ShortcutConfig {
    return {
      send: 'Ctrl+Enter',
      newLine: 'Shift+Enter',
      toggleSidebar: 'Ctrl+B',
      search: 'Ctrl+K',
      nextConversation: 'Alt+ArrowDown',
      prevConversation: 'Alt+ArrowUp',
      closeConversation: 'Ctrl+W',
      snippets: 'Ctrl+/',
      transfer: 'Ctrl+T',
      internalMemo: 'Ctrl+M',
    };
  }

  private getDefaultDashboardLayout(): DashboardLayout {
    return {
      widgets: [
        { id: 'active-conversations', x: 0, y: 0, w: 4, h: 2 },
        { id: 'waiting-queue', x: 4, y: 0, w: 4, h: 2 },
        { id: 'today-stats', x: 8, y: 0, w: 4, h: 2 },
        { id: 'satisfaction-chart', x: 0, y: 2, w: 6, h: 3 },
        { id: 'recent-conversations', x: 6, y: 2, w: 6, h: 3 },
      ],
    };
  }

  private getDefaultNotifications(): NotificationSettings {
    return {
      sound: true,
      desktop: true,
      email: false,
      newConversation: true,
      newMessage: true,
      transfer: true,
    };
  }
}
