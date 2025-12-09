import { useState, useRef, useCallback, useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onImageUpload?: (file: File) => Promise<string | null>;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, onImageUpload, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const isInitializedRef = useRef(false);
  const lastValueRef = useRef(value);

  // 初回マウント時のみinnerHTMLを設定（カーソル位置保持のため）
  useEffect(() => {
    if (editorRef.current && !isInitializedRef.current) {
      editorRef.current.innerHTML = value || '';
      isInitializedRef.current = true;
    }
  }, []);

  // 外部からvalueが変更された場合のみ反映（ユーザー入力以外の変更）
  useEffect(() => {
    if (editorRef.current && isInitializedRef.current) {
      // 現在のエディタ内容と異なり、かつ最後に通知した値とも異なる場合のみ更新
      if (editorRef.current.innerHTML !== value && lastValueRef.current !== value) {
        // カーソル位置を保存
        const selection = window.getSelection();
        const hasSelection = selection && selection.rangeCount > 0;
        let cursorOffset = 0;

        if (hasSelection) {
          const range = selection.getRangeAt(0);
          cursorOffset = range.startOffset;
        }

        editorRef.current.innerHTML = value || '';
        lastValueRef.current = value;

        // カーソル位置を復元（可能な場合）
        if (hasSelection && editorRef.current.childNodes.length > 0) {
          try {
            const range = document.createRange();
            const lastNode = editorRef.current.childNodes[editorRef.current.childNodes.length - 1];
            const textNode = lastNode.nodeType === Node.TEXT_NODE ? lastNode : lastNode.firstChild || lastNode;
            const maxOffset = textNode.textContent?.length || 0;
            range.setStart(textNode, Math.min(cursorOffset, maxOffset));
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
          } catch {
            // カーソル復元に失敗しても続行
          }
        }
      }
    }
  }, [value]);

  // テキスト選択時のレンジを保存
  const savedSelectionRef = useRef<Range | null>(null);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    if (selection && savedSelectionRef.current) {
      selection.removeAllRanges();
      selection.addRange(savedSelectionRef.current);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleBold = () => execCommand('bold');
  const handleItalic = () => execCommand('italic');
  const handleUnderline = () => execCommand('underline');
  const handleStrikethrough = () => execCommand('strikeThrough');

  const handleLink = () => {
    saveSelection();
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      setLinkText(selection.toString());
    }
    setShowLinkModal(true);
  };

  const insertLink = () => {
    if (linkUrl) {
      restoreSelection();
      if (linkText) {
        execCommand('insertHTML', `<a href="${linkUrl}" target="_blank">${linkText}</a>`);
      } else {
        execCommand('createLink', linkUrl);
      }
    }
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;

    const imageUrl = await onImageUpload(file);
    if (imageUrl) {
      execCommand('insertHTML', `<img src="${imageUrl}" style="max-width: 100%;" />`);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFontSize = (size: string) => {
    execCommand('fontSize', size);
  };

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const newValue = editorRef.current.innerHTML;
      lastValueRef.current = newValue;
      onChange(newValue);
    }
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    if (editorRef.current) {
      const newValue = editorRef.current.innerHTML;
      lastValueRef.current = newValue;
      onChange(newValue);
    }
  }, [onChange]);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* ツールバー */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-300 flex-wrap">
        <button
          type="button"
          onClick={handleBold}
          className="p-1.5 hover:bg-gray-200 rounded font-bold text-sm"
          title="太字"
        >
          B
        </button>
        <button
          type="button"
          onClick={handleItalic}
          className="p-1.5 hover:bg-gray-200 rounded italic text-sm"
          title="斜体"
        >
          I
        </button>
        <button
          type="button"
          onClick={handleUnderline}
          className="p-1.5 hover:bg-gray-200 rounded underline text-sm"
          title="下線"
        >
          U
        </button>
        <button
          type="button"
          onClick={handleStrikethrough}
          className="p-1.5 hover:bg-gray-200 rounded line-through text-sm"
          title="取り消し線"
        >
          S
        </button>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={handleLink}
          className="p-1.5 hover:bg-gray-200 rounded text-sm"
          title="リンク"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>

        {onImageUpload && (
          <button
            type="button"
            onClick={handleImageClick}
            className="p-1.5 hover:bg-gray-200 rounded text-sm"
            title="画像挿入"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        )}

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <select
          onChange={(e) => handleFontSize(e.target.value)}
          className="text-xs border border-gray-300 rounded px-1 py-0.5"
          defaultValue="3"
        >
          <option value="1">小</option>
          <option value="3">中</option>
          <option value="5">大</option>
          <option value="7">特大</option>
        </select>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* エディター本体 */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="min-h-[100px] p-3 text-sm focus:outline-none"
        style={{ wordBreak: 'break-word' }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* リンク挿入モーダル */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLinkModal(false)}>
          <div className="bg-white rounded-lg p-4 w-80" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3">リンクを挿入</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">表示テキスト</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  placeholder="リンクテキスト"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">URL</label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  placeholder="https://..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={insertLink}
                  className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-hover"
                >
                  挿入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
