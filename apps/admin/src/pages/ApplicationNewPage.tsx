import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

export default function ApplicationNewPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    welcomeMessage: 'こんにちは！ご質問をお待ちしています。',
    primaryColor: '#3B82F6',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 既存のアプリケーション一覧を取得
      const existingRes = await fetch('/api/settings/applications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      let apps: unknown[] = [];
      if (existingRes.ok) {
        const text = await existingRes.text();
        if (text) {
          try {
            const existing = JSON.parse(text);
            apps = Array.isArray(existing) ? existing : [];
          } catch {
            apps = [];
          }
        }
      }

      // 新しいアプリケーションを追加
      const newApp = {
        id: `app_${Date.now()}`,
        ...formData,
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      await fetch('/api/settings/applications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value: [...apps, newApp] }),
      });

      navigate('/applications');
    } catch (err) {
      console.error('Failed to create application:', err);
      setError('アプリケーションの作成に失敗しました');
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">アプリケーション新規作成</h1>
          <p className="text-sm text-gray-500 mt-1">新しいチャットボットアプリケーションを作成します</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
          {/* Basic Info */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">基本情報</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  アプリケーション名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例: カスタマーサポート"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="アプリケーションの説明を入力してください"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Chat Settings */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">チャット設定</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ウェルカムメッセージ
                </label>
                <textarea
                  value={formData.welcomeMessage}
                  onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  テーマカラー
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-12 h-12 border border-gray-300 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">プレビュー</h2>
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="w-80 bg-white rounded-lg shadow-lg overflow-hidden">
                <div
                  className="px-4 py-3 text-white font-medium"
                  style={{ backgroundColor: formData.primaryColor }}
                >
                  {formData.name || 'アプリケーション名'}
                </div>
                <div className="p-4">
                  <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700">
                    {formData.welcomeMessage}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div>
              {error && (
                <span className="text-red-600 text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/applications')}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name}
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '作成中...' : '作成する'}
            </button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
