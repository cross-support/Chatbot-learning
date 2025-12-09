import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Locale = 'ja' | 'en';

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const translations: Record<Locale, Record<string, string>> = {
  ja: {
    // 共通
    'common.save': '保存',
    'common.cancel': 'キャンセル',
    'common.delete': '削除',
    'common.edit': '編集',
    'common.create': '作成',
    'common.search': '検索',
    'common.loading': '読み込み中...',
    'common.error': 'エラーが発生しました',
    'common.success': '成功しました',
    'common.confirm': '確認',
    'common.yes': 'はい',
    'common.no': 'いいえ',

    // 認証
    'auth.login': 'ログイン',
    'auth.logout': 'ログアウト',
    'auth.email': 'メールアドレス',
    'auth.password': 'パスワード',
    'auth.loginFailed': 'ログインに失敗しました',

    // ナビゲーション
    'nav.dashboard': 'ダッシュボード',
    'nav.chat': 'チャット',
    'nav.scenarios': 'シナリオ',
    'nav.templates': 'テンプレート',
    'nav.statistics': '統計',
    'nav.settings': '設定',
    'nav.monitoring': 'システム監視',

    // チャット
    'chat.conversations': '会話一覧',
    'chat.newMessage': '新しいメッセージ',
    'chat.sendMessage': 'メッセージを送信',
    'chat.close': '終了',
    'chat.assign': 'アサイン',
    'chat.status.bot': 'ボット対応中',
    'chat.status.waiting': '待機中',
    'chat.status.human': '有人対応中',
    'chat.status.closed': '終了',
    'chat.noMessages': 'メッセージはありません',

    // 設定
    'settings.company': '会社情報',
    'settings.widget': 'ウィジェット設定',
    'settings.password': 'パスワードポリシー',
    'settings.users': 'ユーザー管理',
    'settings.notifications': '通知設定',
    'settings.theme': 'テーマ',
    'settings.language': '言語',

    // テーマ
    'theme.light': 'ライト',
    'theme.dark': 'ダーク',
    'theme.system': 'システム設定に従う',

    // 統計
    'stats.conversations': '会話数',
    'stats.messages': 'メッセージ数',
    'stats.users': 'ユーザー数',
    'stats.today': '今日',
    'stats.thisWeek': '今週',
    'stats.thisMonth': '今月',
  },
  en: {
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.success': 'Success',
    'common.confirm': 'Confirm',
    'common.yes': 'Yes',
    'common.no': 'No',

    // Auth
    'auth.login': 'Login',
    'auth.logout': 'Logout',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.loginFailed': 'Login failed',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.chat': 'Chat',
    'nav.scenarios': 'Scenarios',
    'nav.templates': 'Templates',
    'nav.statistics': 'Statistics',
    'nav.settings': 'Settings',
    'nav.monitoring': 'System Monitoring',

    // Chat
    'chat.conversations': 'Conversations',
    'chat.newMessage': 'New Message',
    'chat.sendMessage': 'Send Message',
    'chat.close': 'Close',
    'chat.assign': 'Assign',
    'chat.status.bot': 'Bot Handling',
    'chat.status.waiting': 'Waiting',
    'chat.status.human': 'Human Handling',
    'chat.status.closed': 'Closed',
    'chat.noMessages': 'No messages',

    // Settings
    'settings.company': 'Company Info',
    'settings.widget': 'Widget Settings',
    'settings.password': 'Password Policy',
    'settings.users': 'User Management',
    'settings.notifications': 'Notifications',
    'settings.theme': 'Theme',
    'settings.language': 'Language',

    // Theme
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.system': 'System',

    // Statistics
    'stats.conversations': 'Conversations',
    'stats.messages': 'Messages',
    'stats.users': 'Users',
    'stats.today': 'Today',
    'stats.thisWeek': 'This Week',
    'stats.thisMonth': 'This Month',
  },
};

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'ja',

      setLocale: (locale: Locale) => {
        set({ locale });
        document.documentElement.lang = locale;
      },

      t: (key: string, params?: Record<string, string | number>): string => {
        const { locale } = get();
        let translation = translations[locale][key] || translations.ja[key] || key;

        if (params) {
          Object.entries(params).forEach(([paramKey, value]) => {
            translation = translation.replace(`{${paramKey}}`, String(value));
          });
        }

        return translation;
      },
    }),
    {
      name: 'crossbot-i18n',
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.lang = state.locale;
        }
      },
    }
  )
);

// 便利なヘルパー
export const t = (key: string, params?: Record<string, string | number>): string => {
  return useI18n.getState().t(key, params);
};
