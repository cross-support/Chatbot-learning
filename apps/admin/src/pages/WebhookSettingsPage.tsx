import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  status: number;
  requestBody: string;
  responseBody?: string;
  error?: string;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  { value: 'conversation.created', label: '会話開始' },
  { value: 'conversation.assigned', label: '会話割り当て' },
  { value: 'conversation.closed', label: '会話終了' },
  { value: 'message.received', label: 'メッセージ受信' },
  { value: 'message.sent', label: 'メッセージ送信' },
  { value: 'handover.requested', label: '有人対応要求' },
  { value: 'satisfaction.rated', label: '満足度評価' },
];

export default function WebhookSettingsPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [, setSelectedWebhook] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
  });
  const { token } = useAuthStore();

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/webhooks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // サービスは配列を直接返す
        setWebhooks(Array.isArray(data) ? data : data.webhooks || []);
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // サービスは配列を直接返す
        setLogs(Array.isArray(data) ? data : data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  useEffect(() => {
    fetchWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCreate = async () => {
    if (!formData.name || !formData.url || formData.events.length === 0) {
      alert('名前、URLとイベントを入力してください');
      return;
    }

    try {
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('Webhookを作成しました');
        setShowCreateModal(false);
        setFormData({ name: '', url: '', events: [], secret: '' });
        fetchWebhooks();
      } else {
        alert('Webhookの作成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to create webhook:', error);
      alert('Webhookの作成に失敗しました');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        fetchWebhooks();
      }
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このWebhookを削除してもよろしいですか?')) return;

    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        alert('Webhookを削除しました');
        fetchWebhooks();
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      alert('Webhookの削除に失敗しました');
    }
  };

  const handleShowLogs = (webhookId: string) => {
    setSelectedWebhook(webhookId);
    fetchLogs(webhookId);
    setShowLogsModal(true);
  };

  const toggleEvent = (event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Webhook設定</h1>
            <p className="text-sm text-gray-500 mt-1">外部システムとの連携を設定します</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            新規作成
          </button>
        </div>

        {/* Webhooks List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">URL</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">イベント</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">状態</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">最終実行</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map((webhook) => (
                    <tr key={webhook.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-800 max-w-xs truncate">
                        {webhook.url}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.map((event) => (
                            <span
                              key={event}
                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                            >
                              {AVAILABLE_EVENTS.find((e) => e.value === event)?.label || event}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <button
                          onClick={() => handleToggle(webhook.id, webhook.isActive)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            webhook.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {webhook.isActive ? '有効' : '無効'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {webhook.lastTriggeredAt
                          ? new Date(webhook.lastTriggeredAt).toLocaleString('ja-JP')
                          : '未実行'}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        <button
                          onClick={() => handleShowLogs(webhook.id)}
                          className="text-primary hover:text-primary-hover mr-3"
                        >
                          ログ
                        </button>
                        <button
                          onClick={() => handleDelete(webhook.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {webhooks.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  Webhookが登録されていません
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
                <h3 className="text-lg font-semibold">Webhook新規作成</h3>
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
                    Webhook名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例: Slack通知"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Webhook URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://example.com/webhook"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    トリガーイベント <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_EVENTS.map((event) => (
                      <label
                        key={event.value}
                        className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.events.includes(event.value)}
                          onChange={() => toggleEvent(event.value)}
                          className="w-4 h-4 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">{event.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    シークレット（オプション）
                  </label>
                  <input
                    type="text"
                    value={formData.secret}
                    onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                    placeholder="署名検証用のシークレットキー"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    設定すると、リクエストにHMAC-SHA256署名が付与されます
                  </p>
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
                  作成
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logs Modal */}
        {showLogsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Webhookログ</h3>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            log.status >= 200 && log.status < 300
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {log.status}
                        </span>
                        <span className="text-sm font-medium text-gray-700">{log.event}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleString('ja-JP')}
                      </span>
                    </div>
                    {log.error && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                        {log.error}
                      </div>
                    )}
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-center py-8 text-gray-500">ログがありません</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
