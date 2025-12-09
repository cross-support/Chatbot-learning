import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  key?: string; // 作成時のみ
  permissions: string[];
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

const AVAILABLE_PERMISSIONS = [
  { value: 'conversations:read', label: '会話の読み取り' },
  { value: 'conversations:write', label: '会話の書き込み' },
  { value: 'messages:read', label: 'メッセージの読み取り' },
  { value: 'messages:write', label: 'メッセージの書き込み' },
  { value: 'users:read', label: 'ユーザーの読み取り' },
  { value: 'users:write', label: 'ユーザーの書き込み' },
  { value: 'scenarios:read', label: 'シナリオの読み取り' },
  { value: 'scenarios:write', label: 'シナリオの書き込み' },
  { value: 'statistics:read', label: '統計の読み取り' },
];

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    permissions: [] as string[],
    expiresInDays: 0,
  });
  const { token } = useAuthStore();

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/api-keys', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setApiKeys(Array.isArray(data) ? data : data.apiKeys || []);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCreate = async () => {
    if (!formData.name || formData.permissions.length === 0) {
      alert('名前と権限を入力してください');
      return;
    }

    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setNewApiKey(data.key);
        setShowCreateModal(false);
        setShowKeyModal(true);
        setFormData({ name: '', permissions: [], expiresInDays: 0 });
        fetchApiKeys();
      } else {
        alert('APIキーの作成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
      alert('APIキーの作成に失敗しました');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/api-keys/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        fetchApiKeys();
      }
    } catch (error) {
      console.error('Failed to toggle API key:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このAPIキーを削除してもよろしいですか?')) return;

    try {
      const response = await fetch(`/api/api-keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        alert('APIキーを削除しました');
        fetchApiKeys();
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
      alert('APIキーの削除に失敗しました');
    }
  };

  const togglePermission = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('クリップボードにコピーしました');
  };

  const maskKey = (key: string) => {
    if (!key) return '***';
    return key;
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">APIキー管理</h1>
            <p className="text-sm text-gray-500 mt-1">API連携用のキーを管理します</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            新規発行
          </button>
        </div>

        {/* API Keys List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">名前</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">キー</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">権限</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">状態</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">有効期限</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">最終使用</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((apiKey) => (
                    <tr key={apiKey.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-800 font-medium">
                        {apiKey.name}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            {apiKey.keyPrefix || maskKey(apiKey.key || '')}
                          </code>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {apiKey.permissions.slice(0, 2).map((perm) => (
                            <span
                              key={perm}
                              className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
                            >
                              {AVAILABLE_PERMISSIONS.find((p) => p.value === perm)?.label || perm}
                            </span>
                          ))}
                          {apiKey.permissions.length > 2 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                              +{apiKey.permissions.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <button
                          onClick={() => handleToggle(apiKey.id, apiKey.isActive)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            apiKey.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {apiKey.isActive ? '有効' : '無効'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {apiKey.expiresAt
                          ? new Date(apiKey.expiresAt).toLocaleDateString('ja-JP')
                          : '無期限'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {apiKey.lastUsedAt
                          ? new Date(apiKey.lastUsedAt).toLocaleString('ja-JP')
                          : '未使用'}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        <button
                          onClick={() => handleDelete(apiKey.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {apiKeys.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  APIキーが登録されていません
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">APIキー新規発行</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    キー名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例: 外部システム連携用"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    権限 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_PERMISSIONS.map((perm) => (
                      <label
                        key={perm.value}
                        className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.value)}
                          onChange={() => togglePermission(perm.value)}
                          className="w-4 h-4 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    有効期限
                  </label>
                  <select
                    value={formData.expiresInDays}
                    onChange={(e) =>
                      setFormData({ ...formData, expiresInDays: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  >
                    <option value={0}>無期限</option>
                    <option value={30}>30日</option>
                    <option value={90}>90日</option>
                    <option value={180}>180日</option>
                    <option value={365}>1年</option>
                  </select>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex gap-2">
                    <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <div className="text-sm font-medium text-yellow-800">重要</div>
                      <div className="text-xs text-yellow-700 mt-1">
                        APIキーは発行後、一度だけ表示されます。必ず安全な場所に保管してください。
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover"
                >
                  発行
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Key Display Modal */}
        {showKeyModal && newApiKey && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">APIキー発行完了</h3>
                <button
                  onClick={() => {
                    setShowKeyModal(false);
                    setNewApiKey(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm font-medium text-green-800 mb-2">
                    APIキーが発行されました
                  </div>
                  <div className="text-xs text-green-700">
                    以下のキーは一度だけ表示されます。必ずコピーして安全な場所に保管してください。
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">APIキー</label>
                  <div className="flex gap-2">
                    <code className="flex-1 p-3 bg-gray-100 text-gray-800 rounded-lg font-mono text-sm break-all">
                      {newApiKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(newApiKey)}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      コピー
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowKeyModal(false);
                    setNewApiKey(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
