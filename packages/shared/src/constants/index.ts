// ==================== WebSocket イベント ====================
export const WS_EVENTS = {
  // クライアント → サーバー
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  SEND_MESSAGE: 'send_message',
  SELECT_OPTION: 'select_option',
  PAGE_VIEW: 'page_view',
  TYPING: 'typing',
  MARK_READ: 'mark_read',
  USER_CLOSE_CHAT: 'user_close_chat',

  // サーバー → クライアント
  NEW_MESSAGE: 'new_message',
  SCENARIO_RESPONSE: 'scenario_response',
  STATUS_CHANGE: 'status_change',
  TYPING_INDICATOR: 'typing_indicator',
  NEW_REQUEST: 'new_request',
  USER_ACTIVITY: 'user_activity',
  CONNECTION_ACK: 'connection_ack',
  CONVERSATION_UPDATED: 'conversation_updated',
  MESSAGES_READ: 'messages_read',
  ALL_MESSAGES_READ: 'all_messages_read',
  ERROR: 'error',
} as const;

// ==================== API エンドポイント ====================
export const API_ROUTES = {
  // 認証
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
    REFRESH: '/api/auth/refresh',
  },
  // ユーザー
  USERS: {
    BASE: '/api/users',
    SESSION: '/api/users/session',
    BY_ID: (id: string) => `/api/users/${id}`,
    VISITS: (id: string) => `/api/users/${id}/visits`,
  },
  // 会話
  CONVERSATIONS: {
    BASE: '/api/conversations',
    BY_ID: (id: string) => `/api/conversations/${id}`,
    MESSAGES: (id: string) => `/api/conversations/${id}/messages`,
    ASSIGN: (id: string) => `/api/conversations/${id}/assign`,
    STATUS: (id: string) => `/api/conversations/${id}/status`,
    CLOSE: (id: string) => `/api/conversations/${id}/close`,
  },
  // シナリオ
  SCENARIOS: {
    BASE: '/api/scenarios',
    CHILDREN: (id: number) => `/api/scenarios/${id}/children`,
    IMPORT: '/api/scenarios/import',
    EXPORT: '/api/scenarios/export',
  },
  // テンプレート
  TEMPLATES: {
    BASE: '/api/templates',
    BY_ID: (id: string) => `/api/templates/${id}`,
  },
  // アップロード
  UPLOADS: {
    PRESIGNED_URL: '/api/uploads/presigned-url',
    CONFIRM: '/api/uploads/confirm',
  },
  // 管理者
  ADMINS: {
    BASE: '/api/admins',
    BY_ID: (id: string) => `/api/admins/${id}`,
    STATUS: (id: string) => `/api/admins/${id}/status`,
  },
} as const;

// ==================== ステータス ====================
export const CONVERSATION_STATUS = {
  BOT: 'BOT',
  WAITING: 'WAITING',
  HUMAN: 'HUMAN',
  CLOSED: 'CLOSED',
} as const;

export const SENDER_TYPE = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  BOT: 'BOT',
  SYSTEM: 'SYSTEM',
} as const;

export const CONTENT_TYPE = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  FILE: 'FILE',
  OPTION_SELECT: 'OPTION_SELECT',
  OPTION_PROMPT: 'OPTION_PROMPT',
  LINK: 'LINK',
  FORM: 'FORM',
  INTERNAL_MEMO: 'INTERNAL_MEMO',
} as const;

export const ADMIN_STATUS = {
  ONLINE: 'ONLINE',
  BUSY: 'BUSY',
  AWAY: 'AWAY',
  OFFLINE: 'OFFLINE',
} as const;

export const SCENARIO_ACTION = {
  HANDOVER: 'HANDOVER',
  LINK: 'LINK',
  FORM: 'FORM',
  RESTART: 'RESTART',
  DROP_OFF: 'DROP_OFF',
} as const;

// ==================== 設定値 ====================
export const CONFIG = {
  // 画像アップロード
  IMAGE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/heic'],
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.heic'],
  },
  // ファイルアップロード（PDF等のドキュメント）
  FILE: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ALLOWED_EXTENSIONS: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
  },
  // セッション
  SESSION: {
    COOKIE_NAME: 'crossbot_session',
    EXPIRY_HOURS: 24,
  },
  // ウィジェット
  WIDGET: {
    WIDTH: 350,
    HEIGHT: 500,
    MOBILE_BREAKPOINT: 480,
  },
  // 営業時間
  BUSINESS_HOURS: {
    START: 9,  // 9:00
    END: 18,   // 18:00
    DAYS: [1, 2, 3, 4, 5], // 月-金
  },
} as const;

// ==================== メッセージ ====================
export const MESSAGES = {
  SYSTEM: {
    HANDOVER_REQUEST: '担当者にお繋ぎします。ご質問内容を送信後、少々お待ちください。',
    HANDOVER_REQUEST_JP_ONLY: '担当者にお繋ぎします。ご質問内容を送信後、少々お待ちください。\n（日本語のみ対応可能です）',
    OPERATOR_OFFLINE: '現在オペレーターは対応時間外です。後ほどご連絡いたします。',
    WELCOME: 'ご質問の種類をお選びください。',
    WELCOME_AI: 'こんにちは！Cross Learningサポートです。\nご質問がございましたら、お気軽にメッセージをお送りください。',
    CLOSED: 'お問い合わせありがとうございました。',
    AI_UNAVAILABLE: 'ただいまAIアシスタントが利用できません。オペレーターにお繋ぎしますので、少々お待ちください。',
  },
  ERROR: {
    CONNECTION_FAILED: '接続に失敗しました。再試行してください。',
    UPLOAD_FAILED: '画像のアップロードに失敗しました。',
    FILE_TOO_LARGE: 'ファイルサイズが5MBを超えています。',
    INVALID_FILE_TYPE: '対応していないファイル形式です。',
  },
} as const;
