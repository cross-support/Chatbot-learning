import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuthStore } from '../stores/authStore';

export default function UserNewPage() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'OPERATOR' as 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR',
    maxConcurrent: 5,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (formData.password.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          maxConcurrent: formData.maxConcurrent,
        }),
      });

      if (response.ok) {
        navigate('/settings/users');
      } else {
        const data = await response.json();
        setError(data.message || 'アカウントの作成に失敗しました');
      }
    } catch (err) {
      setError('アカウントの作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">アカウント作成</h1>
          <p className="text-sm text-gray-500 mt-1">新しい管理者・オペレーターアカウントを作成します</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="山田 太郎"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="example@cross-learning.net"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                パスワード <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="8文字以上"
                required
                minLength={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                パスワード（確認） <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="パスワードを再入力"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Role & Settings */}
          <div className="space-y-4 mb-6 pt-6 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                権限 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value as typeof formData.role })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              >
                <option value="OPERATOR">オペレーター</option>
                <option value="ADMIN">管理者</option>
                <option value="SUPER_ADMIN">スーパー管理者</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.role === 'SUPER_ADMIN' && 'すべての機能にアクセスできます'}
                {formData.role === 'ADMIN' && '有人チャットと設定の一部にアクセスできます'}
                {formData.role === 'OPERATOR' && '有人チャットのみ利用できます'}
              </p>
            </div>

            {(formData.role === 'OPERATOR' || formData.role === 'ADMIN') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最大同時対応数
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.maxConcurrent}
                  onChange={(e) =>
                    setFormData({ ...formData, maxConcurrent: parseInt(e.target.value) })
                  }
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  同時に担当できるチャットの最大数
                </p>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 mb-2">権限の説明</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>
                <strong>オペレーター:</strong> 有人チャット対応のみ
              </li>
              <li>
                <strong>管理者:</strong> チャット対応 + テンプレート編集 + レポート閲覧
              </li>
              <li>
                <strong>スーパー管理者:</strong> すべての機能 + システム設定 + ユーザー管理
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/settings/users')}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '作成中...' : '作成する'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
