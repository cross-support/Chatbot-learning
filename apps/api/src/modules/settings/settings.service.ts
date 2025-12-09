import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// デフォルト設定値
const DEFAULT_SETTINGS: Record<string, { value: unknown; description: string }> = {
  company_info: {
    value: {
      companyName: '株式会社クロスリンク',
      displayName: 'Cross Learningサポート',
      email: 'support@cross-learning.net',
      phone: '03-1234-5678',
      address: '東京都渋谷区〇〇1-2-3',
      website: 'https://cross-learning.net',
      logo: '',
    },
    description: '会社情報',
  },
  business_hours: {
    value: {
      enabled: true,
      start: '09:00',
      end: '18:00',
      holidays: ['土', '日', '祝'],
      schedule: [
        { day: 1, start: '09:00', end: '18:00' }, // 月曜
        { day: 2, start: '09:00', end: '18:00' }, // 火曜
        { day: 3, start: '09:00', end: '18:00' }, // 水曜
        { day: 4, start: '09:00', end: '18:00' }, // 木曜
        { day: 5, start: '09:00', end: '18:00' }, // 金曜
      ],
    },
    description: '営業時間設定',
  },
  welcome_message: {
    value: {
      text: 'こんにちは！Cross Learningサポートです。\nご質問の種類をお選びください。',
    },
    description: 'ウェルカムメッセージ',
  },
  offline_message: {
    value: {
      text: '現在オペレーターは対応時間外です。\n営業時間は平日9:00〜18:00となっております。',
    },
    description: 'オフライン時メッセージ',
  },
  ai_settings: {
    value: {
      enabled: true,
      model: 'gpt-4o-mini',
      systemPrompt: 'あなたはCross Learningのサポートアシスタントです。',
    },
    description: 'AI応答設定',
  },
  escalation_keywords: {
    value: {
      keywords: ['返金', '解約', 'バグ', 'エラー', '苦情', 'クレーム'],
    },
    description: '自動エスカレーションキーワード',
  },
};

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getAll(applicationId?: string) {
    // applicationIdが指定されていない場合はデフォルトアプリケーションを取得
    let appId = applicationId;
    if (!appId) {
      const defaultApp = await this.prisma.application.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      appId = defaultApp?.id;
    }

    const settings = await this.prisma.chatSettings.findMany({
      where: appId ? { applicationId: appId } : undefined,
    });

    // デフォルト値とマージ
    const result: Record<string, unknown> = {};
    for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
      const saved = settings.find((s) => s.key === key);
      result[key] = saved ? saved.value : defaultValue.value;
    }

    return result;
  }

  async get(key: string, applicationId?: string) {
    // applicationIdが指定されていない場合はデフォルトアプリケーションを取得
    let appId = applicationId;
    if (!appId) {
      const defaultApp = await this.prisma.application.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      appId = defaultApp?.id;
    }

    // appIdがある場合は複合キーで検索
    if (appId) {
      const setting = await this.prisma.chatSettings.findUnique({
        where: { applicationId_key: { applicationId: appId, key } },
      });

      if (setting) {
        return setting.value;
      }
    }

    // デフォルト値を返す（nullの場合は空オブジェクトを返す）
    const defaultValue = DEFAULT_SETTINGS[key]?.value;
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    // 未定義のキーの場合でも有効なJSONを返す
    return null;
  }

  async set(key: string, value: unknown, applicationId?: string) {
    const description = DEFAULT_SETTINGS[key]?.description;

    // applicationIdが指定されていない場合はデフォルトアプリケーションを取得
    let appId = applicationId;
    if (!appId) {
      const defaultApp = await this.prisma.application.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      appId = defaultApp?.id;
    }

    if (!appId) {
      throw new Error('Application not found');
    }

    return this.prisma.chatSettings.upsert({
      where: { applicationId_key: { applicationId: appId, key } },
      create: {
        key,
        value: value as object,
        description,
        applicationId: appId,
      },
      update: {
        value: value as object,
      },
    });
  }

  async setMultiple(settings: Record<string, unknown>) {
    const results = await Promise.all(
      Object.entries(settings).map(([key, value]) => this.set(key, value))
    );
    return results;
  }

  async reset(key: string) {
    const defaultValue = DEFAULT_SETTINGS[key];
    if (!defaultValue) {
      return null;
    }
    return this.set(key, defaultValue.value);
  }

  async isBusinessHours(): Promise<boolean> {
    const settings = await this.get('business_hours') as {
      enabled: boolean;
      schedule: { day: number; start: string; end: string }[];
    };

    if (!settings?.enabled) {
      return true; // 営業時間チェック無効の場合は常にtrue
    }

    const now = new Date();
    const day = now.getDay(); // 0=日曜, 1=月曜...
    const time = now.toTimeString().slice(0, 5); // HH:MM

    const todaySchedule = settings.schedule?.find((s) => s.day === day);
    if (!todaySchedule) {
      return false;
    }

    return time >= todaySchedule.start && time <= todaySchedule.end;
  }

  /**
   * chat_settingsから営業時間をチェック（RtChatSettingsPageの設定を使用）
   */
  async isBusinessHoursFromChatSettings(): Promise<boolean> {
    const chatSettings = await this.get('chat_settings') as {
      chatStatus?: string;
      schedule?: {
        [key: string]: {
          enabled: boolean;
          slots: { start: string; end: string }[];
        };
      };
      holidays?: string[];
    } | null;

    // chat_settingsが未設定の場合はデフォルトでtrue
    if (!chatSettings) {
      return true;
    }

    // チャットステータスが「受付停止」の場合はfalse
    if (chatSettings.chatStatus === '受付停止') {
      return false;
    }

    const now = new Date();
    // 日本時間に変換
    const japanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const dayOfWeek = japanTime.getDay(); // 0=日曜, 1=月曜...
    const currentTime = japanTime.toTimeString().slice(0, 8); // HH:MM:SS
    const currentDate = japanTime.toISOString().split('T')[0]; // YYYY-MM-DD

    // 曜日のキーマッピング
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayKey = dayKeys[dayOfWeek];

    // 休日チェック
    if (chatSettings.holidays?.includes(currentDate)) {
      // 祝日スロットがあればチェック
      const holidaySchedule = chatSettings.schedule?.holiday;
      if (holidaySchedule && holidaySchedule.slots?.length > 0) {
        return this.isTimeInSlots(currentTime, holidaySchedule.slots);
      }
      return false;
    }

    // 該当曜日のスケジュールをチェック
    const daySchedule = chatSettings.schedule?.[dayKey];
    if (!daySchedule || !daySchedule.slots || daySchedule.slots.length === 0) {
      return false;
    }

    return this.isTimeInSlots(currentTime, daySchedule.slots);
  }

  /**
   * 指定時間がスロット内かどうかをチェック
   */
  private isTimeInSlots(currentTime: string, slots: { start: string; end: string }[]): boolean {
    for (const slot of slots) {
      if (currentTime >= slot.start && currentTime <= slot.end) {
        return true;
      }
    }
    return false;
  }
}
