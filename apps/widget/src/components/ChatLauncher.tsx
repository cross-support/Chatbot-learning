interface ChatLauncherProps {
  onClick: () => void;
  isOpen: boolean;
  unreadCount?: number;
  botIconUrl?: string;
  primaryColor?: string;
}

export function ChatLauncher({ onClick, isOpen, unreadCount = 0, botIconUrl, primaryColor = '#F5A623' }: ChatLauncherProps) {
  return (
    <button
      class="widget-launcher"
      onClick={onClick}
      aria-label={isOpen ? 'チャットを閉じる' : `チャットを開く${unreadCount > 0 ? `（${unreadCount}件の未読メッセージ）` : ''}`}
      aria-expanded={isOpen}
      style={{ backgroundColor: primaryColor }}
    >
      {isOpen ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      ) : (
        <>
          {botIconUrl ? (
            <img src={botIconUrl} alt="Chat" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
              <rect x="3" y="8" width="18" height="12" rx="2" />
              <circle cx="9" cy="14" r="2" />
              <circle cx="15" cy="14" r="2" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              <path d="M12 2v2" />
              <path d="M3 14H1" />
              <path d="M23 14h-2" />
            </svg>
          )}
          {unreadCount > 0 && (
            <span class="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </>
      )}
    </button>
  );
}
