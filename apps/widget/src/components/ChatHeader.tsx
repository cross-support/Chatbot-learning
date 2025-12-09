type ConversationStatus = 'BOT' | 'WAITING' | 'HUMAN' | 'CLOSED';

interface WidgetAppearance {
  botIconUrl?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerColor?: string;
  headerTextColor?: string;
  primaryColor?: string;
}

interface ChatHeaderProps {
  status: ConversationStatus;
  onClose: () => void;
  onEndChat?: () => void;
  onNewChat?: () => void;
  appearance?: WidgetAppearance;
}

const statusLabels: Record<ConversationStatus, string> = {
  BOT: '自動応答',
  WAITING: '接続中...',
  HUMAN: 'オペレーター対応中',
  CLOSED: '終了',
};

// デフォルトのロボットアイコン
const DefaultBotIcon = ({ color = '#F5A623' }: { color?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <circle cx="9" cy="14" r="2" />
    <circle cx="15" cy="14" r="2" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    <path d="M12 2v2" />
    <path d="M3 14H1" />
    <path d="M23 14h-2" />
  </svg>
);

export function ChatHeader({ status, onClose, onEndChat, onNewChat, appearance = {} }: ChatHeaderProps) {
  const showEndChatButton = status === 'HUMAN' || status === 'WAITING';
  const headerColor = appearance.headerColor || '#F5A623';
  const headerTextColor = appearance.headerTextColor || '#FFFFFF';
  const headerTitle = appearance.headerTitle || 'クロスラーニング サポート';
  const primaryColor = appearance.primaryColor || '#F5A623';

  return (
    <header class="widget-header" style={{ backgroundColor: headerColor, color: headerTextColor }} role="banner">
      <div class="widget-header-left">
        <div class="widget-header-avatar" aria-hidden="true">
          {appearance.botIconUrl ? (
            <img src={appearance.botIconUrl} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <DefaultBotIcon color={primaryColor} />
          )}
        </div>
        <div>
          <h1 class="widget-header-title" style={{ margin: 0, fontSize: 'inherit', fontWeight: 'inherit' }}>{headerTitle}</h1>
          <span class="status-badge" role="status" aria-live="polite">{statusLabels[status]}</span>
        </div>
      </div>
      <div class="widget-header-actions">
        {onNewChat && (
          <button
            class="widget-header-new-chat"
            onClick={onNewChat}
            aria-label="新しいチャットを開始"
            title="新しいチャットを開始"
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              color: 'inherit',
              cursor: 'pointer',
              marginRight: '8px',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            新規
          </button>
        )}
        {showEndChatButton && onEndChat && (
          <button class="widget-header-end-chat" onClick={onEndChat} aria-label="チャットを終了">
            終了
          </button>
        )}
        <button class="widget-header-close" onClick={onClose} aria-label="閉じる">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
