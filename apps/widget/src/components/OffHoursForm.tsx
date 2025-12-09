import { useState } from 'preact/hooks';

interface OffHoursFormData {
  name: string;
  email: string;
}

interface OffHoursFormProps {
  apiUrl: string;
  onClose: () => void;
  onSuccess: (data: OffHoursFormData) => void;
}

export function OffHoursForm({ apiUrl, onClose, onSuccess }: OffHoursFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');

    // バリデーション
    if (!name.trim()) {
      setError('受講者氏名を入力してください');
      return;
    }
    if (!email.trim()) {
      setError('メールアドレスを入力してください');
      return;
    }
    if (!content.trim()) {
      setError('問い合わせ内容を入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const baseUrl = apiUrl || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/public/settings/off-hours-inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          content: content.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('送信に失敗しました');
      }

      onSuccess({ name: name.trim(), email: email.trim() });
    } catch (err) {
      console.error('Off-hours inquiry error:', err);
      setError('送信に失敗しました。しばらくしてからもう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="off-hours-form-container">
      <div class="off-hours-header">
        <div class="off-hours-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2>営業時間外のお知らせ</h2>
        <p>
          現在、オペレーター対応時間外です。<br />
          以下のフォームよりお問い合わせいただければ、<br />
          営業時間内に折り返しご連絡いたします。
        </p>
      </div>

      <form onSubmit={handleSubmit} class="off-hours-form">
        <div class="form-group">
          <label for="name">
            受講者氏名 <span class="required">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="山田 太郎"
            disabled={isSubmitting}
          />
        </div>

        <div class="form-group">
          <label for="email">
            メールアドレス <span class="required">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            placeholder="example@email.com"
            disabled={isSubmitting}
          />
        </div>

        <div class="form-group">
          <label for="company">派遣会社</label>
          <input
            type="text"
            id="company"
            value={company}
            onInput={(e) => setCompany((e.target as HTMLInputElement).value)}
            placeholder="株式会社〇〇"
            disabled={isSubmitting}
          />
        </div>

        <div class="form-group">
          <label for="content">
            問い合わせ内容 <span class="required">*</span>
          </label>
          <textarea
            id="content"
            value={content}
            onInput={(e) => setContent((e.target as HTMLTextAreaElement).value)}
            placeholder="お問い合わせ内容をご記入ください"
            rows={4}
            disabled={isSubmitting}
          />
        </div>

        {error && <div class="form-error">{error}</div>}

        <div class="form-actions">
          <button
            type="button"
            class="btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            閉じる
          </button>
          <button
            type="submit"
            class="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? '送信中...' : '送信する'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface OffHoursSuccessMessageProps {
  onClose: () => void;
  email?: string;
  name?: string;
}

export function OffHoursSuccessMessage({ onClose, email, name }: OffHoursSuccessMessageProps) {
  return (
    <div class="off-hours-success">
      <div class="success-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="9 12 12 15 16 10" />
        </svg>
      </div>
      <h2>お問い合わせを受け付けました</h2>
      {name && (
        <p class="success-name">{name} 様</p>
      )}
      <p class="success-message">
        お問い合わせありがとうございます。<br />
        営業時間内に担当者よりご連絡いたします。
      </p>
      {email && (
        <div class="success-email-info">
          <div class="email-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div class="email-text">
            <span class="email-label">返信先:</span>
            <span class="email-address">{email}</span>
          </div>
        </div>
      )}
      <p class="success-note">
        ※ 返信は上記メールアドレス宛に送信されます。<br />
        メールが届かない場合は迷惑メールフォルダをご確認ください。
      </p>
      <button class="btn-primary" onClick={onClose}>
        閉じる
      </button>
    </div>
  );
}
