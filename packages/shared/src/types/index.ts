// ==================== 会話ステータス ====================
export type ConversationStatus = 'BOT' | 'WAITING' | 'HUMAN' | 'CLOSED';

// ==================== 送信者タイプ ====================
export type SenderType = 'USER' | 'ADMIN' | 'BOT' | 'SYSTEM';

// ==================== コンテンツタイプ ====================
export type ContentType = 'TEXT' | 'IMAGE' | 'OPTION_SELECT' | 'OPTION_PROMPT' | 'LINK' | 'FORM' | 'INTERNAL_MEMO';

// ==================== 管理者ロール ====================
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';

// ==================== 管理者ステータス ====================
export type AdminStatus = 'ONLINE' | 'BUSY' | 'AWAY' | 'OFFLINE';

// ==================== シナリオアクション ====================
export type ScenarioAction = 'HANDOVER' | 'LINK' | 'FORM' | 'RESTART' | 'DROP_OFF' | 'MAIL' | 'CSV' | 'JUMP';

// ==================== ユーザー情報 ====================
export interface User {
  id: string;
  sessionId: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  lmsUserId?: string;
  metadata?: UserMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMetadata {
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  deviceType?: 'PC' | 'Mobile' | 'Tablet';
  screenResolution?: string;
  language?: string;
  timezone?: string;
}

// ==================== 管理者情報 ====================
export interface Admin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  status: AdminStatus;
  maxConcurrent: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== 会話 ====================
export interface Conversation {
  id: string;
  userId: string;
  user?: User;
  assignedAdminId?: string;
  admin?: Admin;
  status: ConversationStatus;
  channel: string;
  metadata?: Record<string, unknown>;
  startedAt: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== メッセージ ====================
export interface Message {
  id: string;
  conversationId: string;
  senderType: SenderType;
  contentType: ContentType;
  content: string;
  payload?: MessagePayload;
  isRead: boolean;
  createdAt: Date;
}

export interface MessagePayload {
  imageUrl?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  fileName?: string;
  nodeId?: number;
  options?: ScenarioOption[];
  link?: string;
  [key: string]: unknown;
}

// ==================== シナリオ ====================
export interface ScenarioNode {
  id: number;
  parentId?: number;
  level: number;
  triggerText: string;
  responseText?: string;
  action?: ScenarioAction;
  actionValue?: string;
  order: number;
  isActive: boolean;
  children?: ScenarioNode[];
}

export interface ScenarioOption {
  nodeId: number;
  label: string;
  type?: 'go_to' | 'button' | 'link';  // ボタンタイプ
  linkTarget?: string;                  // リンク先URL
}

export interface ScenarioResponse {
  message: string;
  options: ScenarioOption[];
  action?: ScenarioAction;
  actionValue?: string;
}

// ==================== 訪問ログ ====================
export interface VisitLog {
  id: string;
  userId: string;
  url: string;
  pageTitle?: string;
  referrer?: string;
  duration?: number;
  visitedAt: Date;
}

// ==================== テンプレート ====================
export interface Template {
  id: string;
  code: string;
  name: string;
  content: string;
  category?: string;
  order: number;
  isActive: boolean;
}

// ==================== LMS連携 ====================
export interface LmsUserInfo {
  id: string;
  name: string;
  email?: string;
  company?: string;
  department?: string;
  currentCourseId?: string;
  currentCourseName?: string;
  progress?: number;
  lastAccessedAt?: Date;
}

export interface LmsCourseInfo {
  id: string;
  name: string;
  description?: string;
  totalLessons: number;
  completedLessons: number;
  progress: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

export interface LmsEventData {
  lmsUserId: string;
  eventType: 'course_start' | 'lesson_complete' | 'course_complete' | 'quiz_submit' | 'help_request';
  courseId?: string;
  lessonId?: string;
  metadata?: Record<string, unknown>;
}
