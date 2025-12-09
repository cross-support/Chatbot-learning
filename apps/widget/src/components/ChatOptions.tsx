import { useState } from 'preact/hooks';

interface ScenarioOption {
  nodeId: number;
  label: string;
}

interface ChatOptionsProps {
  options: ScenarioOption[];
  onSelect: (nodeId: number) => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

const MAX_VISIBLE_OPTIONS = 4;

export function ChatOptions({ options, onSelect, onBack, canGoBack }: ChatOptionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // オペレーターに繋ぐ選択肢を分離（常に表示）
  const operatorOption = options.find(opt =>
    opt.label.includes('オペレーター') ||
    opt.label.includes('担当者') ||
    opt.label.includes('人に繋')
  );
  const regularOptions = options.filter(opt => opt !== operatorOption);

  // 表示する通常選択肢
  const visibleOptions = isExpanded
    ? regularOptions
    : regularOptions.slice(0, MAX_VISIBLE_OPTIONS);
  const hiddenCount = regularOptions.length - MAX_VISIBLE_OPTIONS;
  const hasMore = hiddenCount > 0 && !isExpanded;

  return (
    <div class="cb-options-container">
      {/* 戻るボタン */}
      {canGoBack && onBack && (
        <button
          class="cb-back-button"
          onClick={onBack}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>戻る</span>
        </button>
      )}

      {/* 選択肢リスト */}
      <div class="cb-options-list">
        {visibleOptions.map((option) => (
          <button
            key={option.nodeId}
            class="cb-option-button"
            onClick={() => onSelect(option.nodeId)}
          >
            {option.label}
          </button>
        ))}

        {/* もっと見るボタン */}
        {hasMore && (
          <button
            class="cb-expand-button"
            onClick={() => setIsExpanded(true)}
          >
            <span>他 {hiddenCount} 件の選択肢を表示</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}

        {/* 折りたたむボタン */}
        {isExpanded && regularOptions.length > MAX_VISIBLE_OPTIONS && (
          <button
            class="cb-expand-button"
            onClick={() => setIsExpanded(false)}
          >
            <span>折りたたむ</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        )}
      </div>

      {/* オペレーター接続（常に下部に表示） */}
      {operatorOption && (
        <div class="cb-operator-option">
          <button
            class="cb-operator-button"
            onClick={() => onSelect(operatorOption.nodeId)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>{operatorOption.label}</span>
          </button>
        </div>
      )}
    </div>
  );
}
