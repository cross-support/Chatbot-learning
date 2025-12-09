import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type Locale = 'ja' | 'en';

// 翻訳データ
const translations: Record<Locale, Record<string, string>> = {
  ja: {
    // 共通
    'common.save': '保存',
    'common.cancel': 'キャンセル',
    'common.edit': '編集',
    'common.delete': '削除',
    'common.confirm': '確認',
    'common.loading': '読み込み中...',
    'common.search': '検索',
    'common.create': '新規作成',
    'common.close': '閉じる',
    'common.success': '成功',
    'common.error': 'エラー',
    'common.required': '必須',
    'common.optional': '任意',
    'common.all': 'すべて',
    'common.none': 'なし',
    'common.yes': 'はい',
    'common.no': 'いいえ',

    // ナビゲーション
    'nav.dashboard': 'ダッシュボード',
    'nav.chat': 'チャット',
    'nav.scenarios': 'シナリオ',
    'nav.templates': 'テンプレート',
    'nav.statistics': '統計',
    'nav.settings': '設定',
    'nav.admins': '管理者',
    'nav.profile': 'プロフィール',
    'nav.notifications': '通知設定',
    'nav.apiKeys': 'APIキー',
    'nav.logout': 'ログアウト',

    // ログイン
    'login.title': '管理画面にログイン',
    'login.email': 'メールアドレス',
    'login.password': 'パスワード',
    'login.submit': 'ログイン',
    'login.error': 'ログインに失敗しました',
    'login.2fa.title': '2段階認証',
    'login.2fa.description': '認証アプリに表示されている6桁のコードを入力してください',
    'login.2fa.code': '認証コード',
    'login.2fa.submit': '確認',
    'login.2fa.back': 'ログイン画面に戻る',

    // プロフィール
    'profile.title': 'プロフィール',
    'profile.tab.profile': 'プロフィール',
    'profile.tab.security': 'セキュリティ',
    'profile.tab.preferences': '設定',
    'profile.name': '名前',
    'profile.email': 'メールアドレス',
    'profile.phone': '電話番号',
    'profile.department': '部署',
    'profile.position': '役職',
    'profile.bio': '自己紹介',
    'profile.avatar': 'アバター',
    'profile.changeAvatar': 'アバターを変更',
    'profile.language': '言語',
    'profile.timezone': 'タイムゾーン',
    'profile.theme': 'テーマ',
    'profile.theme.light': 'ライト',
    'profile.theme.dark': 'ダーク',
    'profile.theme.system': 'システム',

    // セキュリティ
    'security.password.change': 'パスワード変更',
    'security.password.current': '現在のパスワード',
    'security.password.new': '新しいパスワード',
    'security.password.confirm': '新しいパスワード（確認）',
    'security.2fa.title': '2要素認証',
    'security.2fa.enable': '有効にする',
    'security.2fa.disable': '無効にする',
    'security.2fa.enabled': '有効',
    'security.2fa.disabled': '無効',
    'security.sessions.title': 'アクティブセッション',
    'security.sessions.current': '現在のセッション',
    'security.sessions.terminate': 'セッションを終了',
    'security.sessions.terminateAll': 'すべてのセッションを終了',

    // 通知
    'notifications.title': '通知設定',
    'notifications.email': 'メール通知',
    'notifications.browser': 'ブラウザ通知',
    'notifications.slack': 'Slack連携',
    'notifications.line': 'LINE通知',
    'notifications.chatwork': 'Chatwork連携',
    'notifications.test': 'テスト送信',

    // 設定
    'settings.company': '会社情報',
    'settings.companyName': '会社名',
    'settings.displayName': '表示名',
    'settings.businessHours': '営業時間',
    'settings.mailServer': 'メールサーバー',
    'settings.security': 'セキュリティ',
    'settings.ipRestriction': 'IPアドレス制限',

    // チャット
    'chat.newConversation': '新規会話',
    'chat.waiting': '対応待ち',
    'chat.inProgress': '対応中',
    'chat.resolved': '解決済み',
    'chat.startSupport': '対応を開始',
    'chat.endSupport': '有人チャットを終了',
    'chat.typing': '入力中...',
    'chat.send': '送信',
    'chat.attachFile': 'ファイルを添付',

    // APIキー
    'apiKeys.title': 'APIキー管理',
    'apiKeys.create': '新規発行',
    'apiKeys.name': 'キー名',
    'apiKeys.key': 'キー',
    'apiKeys.permissions': '権限',
    'apiKeys.status': 'ステータス',
    'apiKeys.active': '有効',
    'apiKeys.inactive': '無効',
    'apiKeys.expires': '有効期限',
    'apiKeys.lastUsed': '最終使用',
    'apiKeys.regenerate': '再生成',
    'apiKeys.copyWarning': 'APIキーは発行後、一度だけ表示されます。必ず安全な場所に保管してください。',
  },
  en: {
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
    'common.loading': 'Loading...',
    'common.search': 'Search',
    'common.create': 'Create',
    'common.close': 'Close',
    'common.success': 'Success',
    'common.error': 'Error',
    'common.required': 'Required',
    'common.optional': 'Optional',
    'common.all': 'All',
    'common.none': 'None',
    'common.yes': 'Yes',
    'common.no': 'No',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.chat': 'Chat',
    'nav.scenarios': 'Scenarios',
    'nav.templates': 'Templates',
    'nav.statistics': 'Statistics',
    'nav.settings': 'Settings',
    'nav.admins': 'Administrators',
    'nav.profile': 'Profile',
    'nav.notifications': 'Notifications',
    'nav.apiKeys': 'API Keys',
    'nav.logout': 'Logout',

    // Login
    'login.title': 'Sign in to Admin Panel',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.error': 'Login failed',
    'login.2fa.title': 'Two-Factor Authentication',
    'login.2fa.description': 'Enter the 6-digit code from your authenticator app',
    'login.2fa.code': 'Authentication Code',
    'login.2fa.submit': 'Verify',
    'login.2fa.back': 'Back to Login',

    // Profile
    'profile.title': 'Profile',
    'profile.tab.profile': 'Profile',
    'profile.tab.security': 'Security',
    'profile.tab.preferences': 'Preferences',
    'profile.name': 'Name',
    'profile.email': 'Email',
    'profile.phone': 'Phone',
    'profile.department': 'Department',
    'profile.position': 'Position',
    'profile.bio': 'Bio',
    'profile.avatar': 'Avatar',
    'profile.changeAvatar': 'Change Avatar',
    'profile.language': 'Language',
    'profile.timezone': 'Timezone',
    'profile.theme': 'Theme',
    'profile.theme.light': 'Light',
    'profile.theme.dark': 'Dark',
    'profile.theme.system': 'System',

    // Security
    'security.password.change': 'Change Password',
    'security.password.current': 'Current Password',
    'security.password.new': 'New Password',
    'security.password.confirm': 'Confirm New Password',
    'security.2fa.title': 'Two-Factor Authentication',
    'security.2fa.enable': 'Enable',
    'security.2fa.disable': 'Disable',
    'security.2fa.enabled': 'Enabled',
    'security.2fa.disabled': 'Disabled',
    'security.sessions.title': 'Active Sessions',
    'security.sessions.current': 'Current Session',
    'security.sessions.terminate': 'Terminate Session',
    'security.sessions.terminateAll': 'Terminate All Sessions',

    // Notifications
    'notifications.title': 'Notification Settings',
    'notifications.email': 'Email Notifications',
    'notifications.browser': 'Browser Notifications',
    'notifications.slack': 'Slack Integration',
    'notifications.line': 'LINE Notifications',
    'notifications.chatwork': 'Chatwork Integration',
    'notifications.test': 'Send Test',

    // Settings
    'settings.company': 'Company Info',
    'settings.companyName': 'Company Name',
    'settings.displayName': 'Display Name',
    'settings.businessHours': 'Business Hours',
    'settings.mailServer': 'Mail Server',
    'settings.security': 'Security',
    'settings.ipRestriction': 'IP Restriction',

    // Chat
    'chat.newConversation': 'New Conversation',
    'chat.waiting': 'Waiting',
    'chat.inProgress': 'In Progress',
    'chat.resolved': 'Resolved',
    'chat.startSupport': 'Start Support',
    'chat.endSupport': 'End Support',
    'chat.typing': 'Typing...',
    'chat.send': 'Send',
    'chat.attachFile': 'Attach File',

    // API Keys
    'apiKeys.title': 'API Key Management',
    'apiKeys.create': 'Create New',
    'apiKeys.name': 'Key Name',
    'apiKeys.key': 'Key',
    'apiKeys.permissions': 'Permissions',
    'apiKeys.status': 'Status',
    'apiKeys.active': 'Active',
    'apiKeys.inactive': 'Inactive',
    'apiKeys.expires': 'Expires',
    'apiKeys.lastUsed': 'Last Used',
    'apiKeys.regenerate': 'Regenerate',
    'apiKeys.copyWarning': 'The API key will only be shown once. Please save it in a secure location.',
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem('locale') as Locale;
    return stored || 'ja';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    localStorage.setItem('locale', newLocale);
    setLocaleState(newLocale);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string>): string => {
    let text = translations[locale][key] || translations.ja[key] || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(`{{${paramKey}}}`, value);
      });
    }

    return text;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
