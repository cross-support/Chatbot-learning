import { useState, useRef } from 'preact/hooks';

interface ChatInputProps {
  disabled: boolean;
  placeholder: string;
  onSend: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
}

export function ChatInput({ disabled, placeholder, onSend, onTyping }: ChatInputProps) {
  const [value, setValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setValue(target.value);

    // タイピングインジケーター
    onTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1000);
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;

    onSend(value.trim());
    setValue('');
    onTyping(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    // TODO: 画像アップロード処理
    console.log('Selected file:', file.name);
    target.value = '';
  };

  return (
    <form class="widget-input-area" onSubmit={handleSubmit}>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/gif,image/heic"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        type="button"
        class="widget-attach-button"
        onClick={handleAttachClick}
        disabled={disabled}
        aria-label="画像を添付"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
        </svg>
      </button>
      <input
        type="text"
        class="widget-input"
        value={value}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button
        type="submit"
        class="widget-send-button"
        disabled={disabled || !value.trim()}
        aria-label="送信"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </form>
  );
}
