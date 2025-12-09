import { useState } from 'preact/hooks';

interface SatisfactionSurveyProps {
  conversationId: string;
  apiUrl: string;
  onComplete: () => void;
  onSkip: () => void;
  primaryColor?: string;
}

const CATEGORIES = [
  { id: 'response_quality', label: '回答の質' },
  { id: 'response_speed', label: '対応の速さ' },
  { id: 'friendliness', label: '親切さ' },
  { id: 'resolution', label: '問題解決' },
];

export function SatisfactionSurvey({
  conversationId,
  apiUrl,
  onComplete,
  onSkip,
  primaryColor = '#F5A623',
}: SatisfactionSurveyProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<'rating' | 'details'>('rating');

  const handleRatingSelect = (value: number) => {
    setRating(value);
    // 低評価の場合は詳細ステップへ
    if (value <= 3) {
      setStep('details');
    } else {
      // 高評価の場合はすぐに送信
      handleSubmit(value);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((c) => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSubmit = async (ratingValue?: number) => {
    const finalRating = ratingValue ?? rating;
    if (finalRating === null) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/api/surveys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          rating: finalRating,
          feedback: feedback || undefined,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(onComplete, 2000);
      }
    } catch (error) {
      console.error('Survey submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div class="survey-container">
        <div class="survey-success">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <p>ご回答ありがとうございました！</p>
        </div>
      </div>
    );
  }

  return (
    <div class="survey-container">
      {step === 'rating' ? (
        <>
          <div class="survey-header">
            <h3>本日のサポートはいかがでしたか？</h3>
            <p>ご評価をお聞かせください</p>
          </div>

          <div class="survey-rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => handleRatingSelect(value)}
                class={`survey-star ${rating === value ? 'active' : ''}`}
                style={{ color: rating && rating >= value ? primaryColor : '#d1d5db' }}
                disabled={submitting}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>

          <div class="survey-labels">
            <span>不満</span>
            <span>満足</span>
          </div>

          <button onClick={onSkip} class="survey-skip" disabled={submitting}>
            スキップ
          </button>
        </>
      ) : (
        <>
          <div class="survey-header">
            <h3>改善点を教えてください</h3>
            <p>今後のサービス向上に役立てさせていただきます</p>
          </div>

          <div class="survey-categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                class={`survey-category ${selectedCategories.includes(cat.id) ? 'active' : ''}`}
                style={selectedCategories.includes(cat.id) ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div class="survey-feedback">
            <textarea
              value={feedback}
              onInput={(e) => setFeedback((e.target as HTMLTextAreaElement).value)}
              placeholder="ご意見・ご要望があればお聞かせください（任意）"
              rows={3}
            />
          </div>

          <div class="survey-actions">
            <button onClick={() => setStep('rating')} class="survey-back">
              戻る
            </button>
            <button
              onClick={() => handleSubmit()}
              class="survey-submit"
              style={{ backgroundColor: primaryColor }}
              disabled={submitting}
            >
              {submitting ? '送信中...' : '送信する'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
