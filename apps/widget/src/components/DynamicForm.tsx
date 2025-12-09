import { useState } from 'preact/hooks';

// フォームフィールド定義
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'number' | 'date';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[]; // select/radio用
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

// フォーム設定
export interface FormConfig {
  formId: string;
  title?: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
  cancelLabel?: string;
}

interface DynamicFormProps {
  config: FormConfig;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function DynamicForm({ config, onSubmit, onCancel, isSubmitting = false }: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (name: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    // エラーをクリア
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateField = (field: FormField, value: unknown): string | null => {
    const strValue = String(value || '').trim();

    // 必須チェック
    if (field.required && !strValue) {
      return `${field.label}は必須です`;
    }

    if (!strValue) return null;

    // バリデーション
    if (field.validation) {
      const { pattern, minLength, maxLength, min, max } = field.validation;

      if (pattern && !new RegExp(pattern).test(strValue)) {
        return `${field.label}の形式が正しくありません`;
      }

      if (minLength && strValue.length < minLength) {
        return `${field.label}は${minLength}文字以上で入力してください`;
      }

      if (maxLength && strValue.length > maxLength) {
        return `${field.label}は${maxLength}文字以内で入力してください`;
      }

      if (field.type === 'number') {
        const numValue = Number(strValue);
        if (min !== undefined && numValue < min) {
          return `${field.label}は${min}以上で入力してください`;
        }
        if (max !== undefined && numValue > max) {
          return `${field.label}は${max}以下で入力してください`;
        }
      }
    }

    // メール形式チェック
    if (field.type === 'email' && strValue) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(strValue)) {
        return 'メールアドレスの形式が正しくありません';
      }
    }

    return null;
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();

    // 全フィールドのバリデーション
    const newErrors: Record<string, string> = {};
    for (const field of config.fields) {
      const error = validateField(field, formData[field.name]);
      if (error) {
        newErrors[field.name] = error;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];

    const commonProps = {
      id: field.name,
      name: field.name,
      disabled: isSubmitting,
      class: `dynamic-form-input ${error ? 'dynamic-form-input-error' : ''}`,
    };

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            value={value as string}
            placeholder={field.placeholder}
            rows={4}
            onInput={(e) => handleFieldChange(field.name, (e.target as HTMLTextAreaElement).value)}
          />
        );

      case 'select':
        return (
          <select
            {...commonProps}
            value={value as string}
            onChange={(e) => handleFieldChange(field.name, (e.target as HTMLSelectElement).value)}
          >
            <option value="">{field.placeholder || '選択してください'}</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <label class="dynamic-form-checkbox">
            <input
              type="checkbox"
              id={field.name}
              name={field.name}
              checked={value as boolean}
              disabled={isSubmitting}
              onChange={(e) => handleFieldChange(field.name, (e.target as HTMLInputElement).checked)}
            />
            <span>{field.placeholder || field.label}</span>
          </label>
        );

      case 'radio':
        return (
          <div class="dynamic-form-radio-group">
            {field.options?.map(opt => (
              <label key={opt.value} class="dynamic-form-radio">
                <input
                  type="radio"
                  name={field.name}
                  value={opt.value}
                  checked={value === opt.value}
                  disabled={isSubmitting}
                  onChange={() => handleFieldChange(field.name, opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        );

      default:
        return (
          <input
            {...commonProps}
            type={field.type}
            value={value as string}
            placeholder={field.placeholder}
            onInput={(e) => handleFieldChange(field.name, (e.target as HTMLInputElement).value)}
          />
        );
    }
  };

  return (
    <div class="dynamic-form-container">
      {config.title && (
        <div class="dynamic-form-header">
          <h3 class="dynamic-form-title">{config.title}</h3>
          {config.description && (
            <p class="dynamic-form-description">{config.description}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} class="dynamic-form">
        {config.fields.map(field => (
          <div key={field.name} class="dynamic-form-group">
            {field.type !== 'checkbox' && (
              <label for={field.name} class="dynamic-form-label">
                {field.label}
                {field.required && <span class="dynamic-form-required">*</span>}
              </label>
            )}
            {renderField(field)}
            {errors[field.name] && (
              <span class="dynamic-form-error">{errors[field.name]}</span>
            )}
          </div>
        ))}

        <div class="dynamic-form-actions">
          <button
            type="button"
            class="dynamic-form-btn-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {config.cancelLabel || 'キャンセル'}
          </button>
          <button
            type="submit"
            class="dynamic-form-btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? '送信中...' : (config.submitLabel || '送信')}
          </button>
        </div>
      </form>
    </div>
  );
}

// デフォルトのフォーム設定を取得
export function getDefaultFormConfig(formId: string): FormConfig | null {
  const defaultForms: Record<string, FormConfig> = {
    contact: {
      formId: 'contact',
      title: 'お問い合わせ',
      description: '以下のフォームにご記入ください',
      fields: [
        { name: 'name', label: 'お名前', type: 'text', required: true, placeholder: '山田 太郎' },
        { name: 'email', label: 'メールアドレス', type: 'email', required: true, placeholder: 'example@email.com' },
        { name: 'phone', label: '電話番号', type: 'tel', placeholder: '090-1234-5678' },
        { name: 'content', label: 'お問い合わせ内容', type: 'textarea', required: true, placeholder: 'お問い合わせ内容をご記入ください' },
      ],
      submitLabel: '送信する',
    },
    feedback: {
      formId: 'feedback',
      title: 'フィードバック',
      description: 'サービス改善のためにご意見をお聞かせください',
      fields: [
        {
          name: 'rating',
          label: '満足度',
          type: 'radio',
          required: true,
          options: [
            { value: '5', label: '大変満足' },
            { value: '4', label: '満足' },
            { value: '3', label: '普通' },
            { value: '2', label: '不満' },
            { value: '1', label: '大変不満' },
          ],
        },
        { name: 'comment', label: 'コメント', type: 'textarea', placeholder: 'ご意見・ご感想をお聞かせください' },
      ],
      submitLabel: '送信',
    },
    registration: {
      formId: 'registration',
      title: '受講登録',
      description: '受講に必要な情報をご入力ください',
      fields: [
        { name: 'name', label: '受講者氏名', type: 'text', required: true, placeholder: '山田 太郎' },
        { name: 'email', label: 'メールアドレス', type: 'email', required: true, placeholder: 'example@email.com' },
        { name: 'company', label: '会社名', type: 'text', placeholder: '株式会社〇〇' },
        { name: 'department', label: '部署名', type: 'text', placeholder: '営業部' },
        {
          name: 'course',
          label: '希望コース',
          type: 'select',
          required: true,
          options: [
            { value: 'basic', label: '基礎コース' },
            { value: 'advanced', label: '応用コース' },
            { value: 'professional', label: 'プロフェッショナルコース' },
          ],
        },
        { name: 'terms', label: '利用規約に同意する', type: 'checkbox', required: true, placeholder: '利用規約に同意します' },
      ],
      submitLabel: '登録する',
    },
  };

  return defaultForms[formId] || null;
}
