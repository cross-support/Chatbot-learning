import { useState, useRef } from 'preact/hooks';

interface ChatInputProps {
  disabled: boolean;
  placeholder: string;
  onSend: (content: string, contentType?: string) => void;
  onTyping: (isTyping: boolean) => void;
  conversationId?: string | null;
  apiUrl?: string;
  showAiHint?: boolean;
}

interface PendingFile {
  file: File;
  previewUrl: string;
  isImage: boolean;
}

// 許可されるファイルタイプ
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/heic'];
const DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

export function ChatInput({ disabled, placeholder, onSend, onTyping, conversationId, apiUrl, showAiHint }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isComposingRef = useRef(false); // IME変換中フラグ

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
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

  const isSubmittingRef = useRef(false); // 二重送信防止フラグ

  // ファイルアップロードを実行
  const uploadFile = async (): Promise<string | null> => {
    if (!pendingFile || !conversationId) return null;

    const baseUrl = apiUrl || '';
    const formData = new FormData();
    formData.append('file', pendingFile.file);

    const response = await fetch(
      `${baseUrl}/api/uploads/local/${conversationId}/${encodeURIComponent(pendingFile.file.name)}`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'アップロードに失敗しました');
    }

    return result.imageUrl;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (isSubmittingRef.current) return; // 二重送信防止

    // テキストもファイルもない場合は送信しない
    if (!value.trim() && !pendingFile) return;
    if (disabled) return;

    isSubmittingRef.current = true;
    setUploading(true);

    try {
      // ファイルがある場合は先にアップロード
      if (pendingFile) {
        const fileUrl = await uploadFile();
        if (fileUrl) {
          // 画像かファイルかで contentType を分ける
          const contentType = pendingFile.isImage ? 'IMAGE' : 'FILE';
          onSend(fileUrl, contentType);
        }
        // プレビューをクリア
        URL.revokeObjectURL(pendingFile.previewUrl);
        setPendingFile(null);
      }

      // テキストがある場合は送信
      if (value.trim()) {
        onSend(value.trim());
        setValue('');
      }

      onTyping(false);
    } catch (error) {
      console.error('Send failed:', error);
      alert('送信に失敗しました');
    } finally {
      setUploading(false);
      // 次のイベントループで送信フラグをリセット
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 0);
    }
  };

  // IME変換開始
  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  // IME変換終了
  const handleCompositionEnd = () => {
    isComposingRef.current = false;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // IME変換中は送信しない
    if (isComposingRef.current) return;

    // Command+Enter (Mac) または Ctrl+Enter (Windows) で送信、Enter単独は改行
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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
    if (!file || !conversationId) return;

    const isImage = IMAGE_TYPES.includes(file.type);
    const isDocument = DOCUMENT_TYPES.includes(file.type);

    // ファイル形式チェック
    if (!isImage && !isDocument) {
      alert('対応していないファイル形式です\n（画像: JPEG, PNG, GIF, HEIC / 書類: PDF, Word, Excel）');
      target.value = '';
      return;
    }

    // ファイルサイズチェック (画像5MB、ドキュメント10MB)
    const maxSize = isImage ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`ファイルサイズは${maxSize / (1024 * 1024)}MB以下にしてください`);
      target.value = '';
      return;
    }

    // プレビュー用URLを生成してstateに保存
    const previewUrl = isImage ? URL.createObjectURL(file) : '';
    setPendingFile({ file, previewUrl, isImage });
    target.value = '';
  };

  // ファイルプレビューをキャンセル
  const handleCancelFile = () => {
    if (pendingFile) {
      if (pendingFile.previewUrl) {
        URL.revokeObjectURL(pendingFile.previewUrl);
      }
      setPendingFile(null);
    }
  };

  // ファイル拡張子からアイコンを取得
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (ext === 'doc' || ext === 'docx') return '📝';
    if (ext === 'xls' || ext === 'xlsx') return '📊';
    return '📎';
  };

  const canSend = (value.trim() || pendingFile) && !disabled && !uploading;

  return (
    <div class="cb-input-container">
      {/* AI質問促進バナー */}
      {showAiHint && (
        <div class="cb-ai-prompt-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>選択肢以外のご質問も、直接入力できます</span>
        </div>
      )}

      {/* ファイルプレビュー */}
      {pendingFile && (
        <div class="cb-image-preview-container">
          <div class="cb-image-preview-wrapper">
            {pendingFile.isImage ? (
              <img
                src={pendingFile.previewUrl}
                alt="プレビュー"
                class="cb-image-preview-thumb"
                style={{ width: '48px', height: '48px', objectFit: 'cover' }}
              />
            ) : (
              <div class="cb-file-icon" style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '24px' }}>
                {getFileIcon(pendingFile.file.name)}
              </div>
            )}
            <button
              type="button"
              class="cb-image-preview-remove"
              onClick={handleCancelFile}
              aria-label="ファイルを削除"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <span class="cb-image-preview-name">{pendingFile.file.name}</span>
        </div>
      )}

      <form class="widget-input-area" onSubmit={handleSubmit}>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/gif,image/heic,application/pdf,.doc,.docx,.xls,.xlsx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        type="button"
        class="widget-attach-button"
        onClick={handleAttachClick}
        disabled={disabled || uploading || !conversationId}
        aria-label="画像を添付"
      >
        {uploading ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="animate-spin">
            <path d="M12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8A8 8 0 0 1 12 20Z" opacity=".5"/>
            <path d="M20 12h2A10 10 0 0 0 12 2V4A8 8 0 0 1 20 12Z"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
          </svg>
        )}
      </button>
      <textarea
        class="widget-input"
        value={value}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        placeholder={placeholder}
        disabled={disabled || uploading}
        rows={1}
      />
      <button
        type="submit"
        class="widget-send-button"
        disabled={!canSend}
        aria-label="送信"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
      </form>
    </div>
  );
}
