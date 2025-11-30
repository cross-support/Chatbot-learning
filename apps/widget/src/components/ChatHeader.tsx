type ConversationStatus = 'BOT' | 'WAITING' | 'HUMAN' | 'CLOSED';

interface ChatHeaderProps {
  status: ConversationStatus;
  onClose: () => void;
}

const statusLabels: Record<ConversationStatus, string> = {
  BOT: '自動応答',
  WAITING: '接続中...',
  HUMAN: 'オペレーター対応中',
  CLOSED: '終了',
};

export function ChatHeader({ status, onClose }: ChatHeaderProps) {
  return (
    <div class="widget-header">
      <div>
        <div class="widget-header-title">クロスラーニング サポート</div>
        <span class="status-badge">{statusLabels[status]}</span>
      </div>
      <button class="widget-header-close" onClick={onClose} aria-label="閉じる">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>
    </div>
  );
}
