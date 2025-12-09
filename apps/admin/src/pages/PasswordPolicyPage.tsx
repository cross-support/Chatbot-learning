import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expirationDays: number;
  preventReuse: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
}

export default function PasswordPolicyPage() {
  const { token } = useAuth();
  const [policy, setPolicy] = useState<PasswordPolicy>({
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
    expirationDays: 90,
    preventReuse: 3,
    maxLoginAttempts: 5,
    lockoutDuration: 30,
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const res = await fetch('/api/settings/password_policy', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            setPolicy(prev => ({ ...prev, ...data }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch policy:', err);
      } finally {
        setInitialLoading(false);
      }
    };

    if (token) {
      fetchPolicy();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    setError(null);

    try {
      await fetch('/api/settings/password_policy', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value: policy }),
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save policy:', err);
      setError('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const generateSamplePassword = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';

    let chars = '';
    let password = '';

    if (policy.requireUppercase) {
      chars += upper;
      password += upper[Math.floor(Math.random() * upper.length)];
    }
    if (policy.requireLowercase) {
      chars += lower;
      password += lower[Math.floor(Math.random() * lower.length)];
    }
    if (policy.requireNumbers) {
      chars += numbers;
      password += numbers[Math.floor(Math.random() * numbers.length)];
    }
    if (policy.requireSpecialChars) {
      chars += special;
      password += special[Math.floor(Math.random() * special.length)];
    }

    if (!chars) chars = lower + numbers;

    while (password.length < policy.minLength) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }

    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const [samplePassword, setSamplePassword] = useState(generateSamplePassword());

  if (initialLoading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">パスワードポリシー</h1>
          <p className="text-sm text-gray-500 mt-1">ユーザーアカウントのパスワード要件を設定します</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Settings */}
            <div className="lg:col-span-2 space-y-6">
              {/* Password Requirements */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">パスワード要件</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      最小文字数
                    </label>
                    <input
                      type="number"
                      min={6}
                      max={32}
                      value={policy.minLength}
                      onChange={(e) => setPolicy({ ...policy, minLength: parseInt(e.target.value) })}
                      className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      必須文字種
                    </label>

                    {[
                      { key: 'requireUppercase', label: '大文字（A-Z）' },
                      { key: 'requireLowercase', label: '小文字（a-z）' },
                      { key: 'requireNumbers', label: '数字（0-9）' },
                      { key: 'requireSpecialChars', label: '記号（!@#$%^&*）' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={policy[item.key as keyof typeof policy] as boolean}
                          onChange={(e) =>
                            setPolicy({ ...policy, [item.key]: e.target.checked })
                          }
                          className="w-4 h-4 text-primary rounded focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Expiration & Reuse */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">有効期限と再利用</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      有効期限（日数）
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={policy.expirationDays}
                      onChange={(e) => setPolicy({ ...policy, expirationDays: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">0で無期限</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      再利用禁止世代数
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={policy.preventReuse}
                      onChange={(e) => setPolicy({ ...policy, preventReuse: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">過去N回のパスワードと同じ場合拒否</p>
                  </div>
                </div>
              </div>

              {/* Account Lockout */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">アカウントロック</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      最大ログイン試行回数
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={10}
                      value={policy.maxLoginAttempts}
                      onChange={(e) => setPolicy({ ...policy, maxLoginAttempts: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ロック時間（分）
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={1440}
                      value={policy.lockoutDuration}
                      onChange={(e) => setPolicy({ ...policy, lockoutDuration: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-200 p-5 sticky top-6">
                <h2 className="font-semibold text-gray-800 mb-4">現在のポリシー</h2>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">最小文字数</span>
                    <span className="font-medium">{policy.minLength}文字</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">大文字必須</span>
                    <span className={policy.requireUppercase ? 'text-green-600' : 'text-gray-400'}>
                      {policy.requireUppercase ? '有効' : '無効'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">小文字必須</span>
                    <span className={policy.requireLowercase ? 'text-green-600' : 'text-gray-400'}>
                      {policy.requireLowercase ? '有効' : '無効'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">数字必須</span>
                    <span className={policy.requireNumbers ? 'text-green-600' : 'text-gray-400'}>
                      {policy.requireNumbers ? '有効' : '無効'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">記号必須</span>
                    <span className={policy.requireSpecialChars ? 'text-green-600' : 'text-gray-400'}>
                      {policy.requireSpecialChars ? '有効' : '無効'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">有効期限</span>
                    <span className="font-medium">
                      {policy.expirationDays > 0 ? `${policy.expirationDays}日` : '無期限'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">サンプルパスワード</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono">
                      {samplePassword}
                    </code>
                    <button
                      type="button"
                      onClick={() => setSamplePassword(generateSamplePassword())}
                      className="p-2 text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            <div>
              {saved && (
                <span className="text-green-600 text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  保存しました
                </span>
              )}
              {error && (
                <span className="text-red-600 text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
