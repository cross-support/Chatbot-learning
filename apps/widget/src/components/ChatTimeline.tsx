import { useEffect, useRef } from 'preact/hooks';

interface Message {
  id: string;
  senderType: 'USER' | 'ADMIN' | 'BOT' | 'SYSTEM';
  contentType: string;
  content: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

interface ChatTimelineProps {
  messages: Message[];
  isTyping: boolean;
}

export function ChatTimeline({ messages, isTyping }: ChatTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);

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

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div class="widget-timeline" ref={timelineRef}>
      {messages.map((message) => (
        <div key={message.id} class={getMessageClass(message.senderType)}>
          {message.contentType === 'IMAGE' && message.payload?.imageUrl ? (
            <img
              src={message.payload.imageUrl as string}
              alt="送信画像"
              class="image-preview"
              onClick={() => window.open(message.payload?.imageUrl as string, '_blank')}
            />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: formatContent(message.content) }} />
          )}
        </div>
      ))}
      {isTyping && (
        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}
    </div>
  );
}

// コンテンツをフォーマット（リンクなど）
function formatContent(content: string): string {
  // URLをリンクに変換
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let formatted = content.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #007AFF; text-decoration: underline;">$1</a>');

  // 改行を<br>に変換
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}
