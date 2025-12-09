import { useEffect, useRef } from 'preact/hooks';

interface Message {
  id: string;
  senderType: 'USER' | 'ADMIN' | 'BOT' | 'SYSTEM';
  contentType: string;
  content: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  isRead?: boolean;
}

interface ScenarioOption {
  nodeId: number;
  label: string;
  type?: 'go_to' | 'button' | 'link';
  linkTarget?: string;
}

interface ChatTimelineProps {
  messages: Message[];
  isTyping: boolean;
  options?: ScenarioOption[];
  onOptionSelect?: (nodeId: number) => void;
  onBack?: () => void;
  canGoBack?: boolean;
  botIconUrl?: string;
  primaryColor?: string;
  apiUrl?: string;
}

export function ChatTimeline({ messages, isTyping, options = [], onOptionSelect, onBack, canGoBack, botIconUrl, primaryColor = '#F5A623', apiUrl = 'http://localhost:3000' }: ChatTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);

  // CSS変数を更新
  useEffect(() => {
    // Shadow DOM内でCSS変数を設定
    const root = timelineRef.current?.closest('#crossbot-app');
    if (root) {
      (root as HTMLElement).style.setProperty('--primary-color', primaryColor);
    }
  }, [primaryColor]);

  // ファイルURLを絶対URLに変換（相対パスの場合）
  const getFileUrl = (url: string | undefined): string => {
    if (!url) return '';
    // 既に絶対URLの場合はそのまま返す
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // 相対パスの場合はapiUrlを付加
    return `${apiUrl}${url}`;
  };

  // URLからファイル名を取得
  const getFileNameFromUrl = (url: string): string => {
    const decoded = decodeURIComponent(url);
    const parts = decoded.split('/');
    return parts[parts.length - 1] || 'ファイル';
  };

  // ファイル拡張子からアイコンを取得
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (ext === 'doc' || ext === 'docx') return '📝';
    if (ext === 'xls' || ext === 'xlsx') return '📊';
    return '📎';
  };

  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const getMessageClass = (senderType: string): string => {
    switch (senderType) {
      case 'USER':
        return 'message message-user';
      case 'BOT':
      case 'ADMIN':
        return 'message message-bot';
      case 'SYSTEM':
        return 'message message-system';
      default:
        return 'message';
    }
  };

  // ボットアイコン（カスタムまたはデフォルト）
  const BotIcon = () => (
    <div class="message-avatar">
      {botIconUrl ? (
        <img src={botIconUrl} alt="Bot" style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth="1.5">
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <circle cx="9" cy="14" r="2" />
          <circle cx="15" cy="14" r="2" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          <path d="M12 2v2" />
          <path d="M3 14H1" />
          <path d="M23 14h-2" />
        </svg>
      )}
    </div>
  );

  return (
    <div class="widget-timeline" ref={timelineRef}>
      {messages.map((message) => (
        <div key={message.id} class={`message-row ${message.senderType === 'USER' ? 'message-row-user' : 'message-row-bot'}`}>
          {(message.senderType === 'BOT' || message.senderType === 'ADMIN') && (
            <BotIcon />
          )}
          <div class={getMessageClass(message.senderType)}>
            {message.contentType === 'IMAGE' ? (
              <img
                src={getFileUrl((message.payload?.imageUrl as string) || message.content)}
                alt="送信画像"
                class="image-preview"
                onClick={() => window.open(getFileUrl((message.payload?.imageUrl as string) || message.content), '_blank')}
              />
            ) : message.contentType === 'FILE' ? (
              <a
                href={getFileUrl((message.payload?.fileUrl as string) || message.content)}
                target="_blank"
                rel="noopener noreferrer"
                class="file-download-link"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: '#374151',
                }}
              >
                <span style={{ fontSize: '24px' }}>{getFileIcon(getFileNameFromUrl(message.content))}</span>
                <span style={{ fontSize: '13px', wordBreak: 'break-all' }}>{getFileNameFromUrl(message.content)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </a>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: formatContent(message.content) }} />
            )}
            {/* ユーザーメッセージに既読表示 */}
            {message.senderType === 'USER' && message.isRead && (
              <div class="message-read-status">既読</div>
            )}
          </div>
        </div>
      ))}

      {/* 選択肢をボットメッセージの一部として表示 */}
      {options.length > 0 && !isTyping && (
        <div class="message-row message-row-bot">
          <BotIcon />
          <div class="message-options-container">
            {/* 戻るボタン */}
            {canGoBack && onBack && (
              <button class="message-back-button" onClick={onBack}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span>戻る</span>
              </button>
            )}
            {/* 選択肢ボタン */}
            <div class="message-options-list">
              {options.map((option) => (
                option.type === 'link' && option.linkTarget ? (
                  // リンクタイプ: 新しいタブでURLを開く
                  <a
                    key={option.nodeId}
                    href={option.linkTarget}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="message-option-button message-option-link"
                  >
                    {option.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                ) : (
                  // 通常タイプ: シナリオ遷移
                  <button
                    key={option.nodeId}
                    class="message-option-button"
                    onClick={() => onOptionSelect?.(option.nodeId)}
                  >
                    {option.label}
                  </button>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {isTyping && (
        <div class="message-row message-row-bot">
          <BotIcon />
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  );
}

// コンテンツをフォーマット（リンクなど）
function formatContent(content: string): string {
  // nullチェック
  if (!content) {
    return '';
  }

  // HTMLタグを一時的に保護
  const htmlTags: string[] = [];
  let formatted = content.replace(/<[^>]+>/g, (match) => {
    htmlTags.push(match);
    return `__HTML_TAG_${htmlTags.length - 1}__`;
  });

  // URLをリンクに変換（HTMLタグ外のURLのみ）
  const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
  formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #F5A623; text-decoration: underline;">$1</a>');

  // HTMLタグを復元
  formatted = formatted.replace(/__HTML_TAG_(\d+)__/g, (_, index) => htmlTags[parseInt(index)]);

  // 改行を<br>に変換
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}
