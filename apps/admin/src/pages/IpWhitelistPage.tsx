import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface IpWhitelist {
  id: string;
  ipAddress: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

interface AccessLog {
  id: string;
  ipAddress: string;
  adminEmail?: string;
  action: string;
  allowed: boolean;
  createdAt: string;
}

export default function IpWhitelistPage() {
  const [whitelist, setWhitelist] = useState<IpWhitelist[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [formData, setFormData] = useState({
    ipAddress: '',
    description: '',
  });
  const { token } = useAuthStore();

  const fetchWhitelist = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ip-whitelist', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // サービスは配列を直接返す
        setWhitelist(Array.isArray(data) ? data : data.whitelist || []);
      }
    } catch (error) {
      console.error('Failed to fetch IP whitelist:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccessLogs = async () => {
    try {
      const response = await fetch('/api/ip-whitelist/logs?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // サービスは配列を直接返す
        setAccessLogs(Array.isArray(data) ? data : data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch access logs:', error);
    }
  };

  useEffect(() => {
    fetchWhitelist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAdd = async () => {
    if (!formData.ipAddress) {
      alert('IPアドレスを入力してください');
      return;
    }

    // IP address or CIDR validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(formData.ipAddress)) {
      alert('正しいIPアドレスまたはCIDR形式で入力してください');
      return;
    }

    try {
      const response = await fetch('/api/ip-whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('IPアドレスを追加しました');
        setShowAddModal(false);
        setFormData({ ipAddress: '', description: '' });
        fetchWhitelist();
      } else {
        const data = await response.json();
        alert(data.message || 'IPアドレスの追加に失敗しました');
      }
    } catch (error) {
      console.error('Failed to add IP address:', error);
      alert('IPアドレスの追加に失敗しました');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/ip-whitelist/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isEnabled: !isActive }),
      });

      if (response.ok) {
        fetchWhitelist();
      }
    } catch (error) {
      console.error('Failed to toggle IP whitelist:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このIPアドレスを削除してもよろしいですか?')) return;

    try {
      const response = await fetch(`/api/ip-whitelist/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        alert('IPアドレスを削除しました');
        fetchWhitelist();
      }
    } catch (error) {
      console.error('Failed to delete IP address:', error);
      alert('IPアドレスの削除に失敗しました');
    }
  };

  const handleShowLogs = () => {
    fetchAccessLogs();
    setShowLogsModal(true);
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">IP制限</h1>
            <p className="text-sm text-gray-500 mt-1">
              管理画面へのアクセスを許可するIPアドレスを設定します
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleShowLogs}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              アクセスログ
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              IP追加
            </button>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <svg
              className="w-5 h-5 text-yellow-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <div className="text-sm font-medium text-yellow-800">重要な注意事項</div>
              <div className="text-xs text-yellow-700 mt-1">
                IP制限を有効にすると、登録されていないIPアドレスからのアクセスがブロックされます。
                現在のIPアドレスを必ず追加してから有効化してください。
              </div>
            </div>
          </div>
        </div>

        {/* Whitelist Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                      IPアドレス / CIDR
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">説明</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">状態</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">登録者</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">登録日</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {whitelist.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-800 font-mono font-medium">
                        {item.ipAddress}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {item.description || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <button
                          onClick={() => handleToggle(item.id, item.isActive)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            item.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.isActive ? '有効' : '無効'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{item.createdByName}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(item.createdAt).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {whitelist.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  IPアドレスが登録されていません
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">IPアドレス追加</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IPアドレス / CIDR <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    placeholder="例: 192.168.1.1 または 192.168.1.0/24"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    単一IPアドレスまたはCIDR形式で入力してください
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明（オプション）
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="例: 本社オフィス"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs text-blue-700">
                    <strong>CIDR表記例:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>192.168.1.0/24 : 192.168.1.0 〜 192.168.1.255</li>
                      <li>10.0.0.0/8 : 10.0.0.0 〜 10.255.255.255</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover"
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Access Logs Modal */}
        {showLogsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">アクセスログ（最新100件）</h3>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">日時</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">
                        IPアドレス
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">
                        ユーザー
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">
                        操作
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">
                        結果
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessLogs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-xs text-gray-600">
                          {new Date(log.createdAt).toLocaleString('ja-JP')}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-800 font-mono">
                          {log.ipAddress}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-600">
                          {log.adminEmail || '-'}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-600">{log.action}</td>
                        <td className="py-2 px-3 text-xs">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              log.allowed
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {log.allowed ? '許可' : 'ブロック'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {accessLogs.length === 0 && (
                  <div className="text-center py-8 text-gray-500">ログがありません</div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowLogsModal(false)}
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
