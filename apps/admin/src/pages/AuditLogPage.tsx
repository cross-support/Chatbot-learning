import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  changes?: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  'admin.create': '管理者作成',
  'admin.update': '管理者更新',
  'admin.delete': '管理者削除',
  'user.create': 'ユーザー作成',
  'user.update': 'ユーザー更新',
  'user.delete': 'ユーザー削除',
  'scenario.create': 'シナリオ作成',
  'scenario.update': 'シナリオ更新',
  'scenario.delete': 'シナリオ削除',
  'settings.update': '設定更新',
  'webhook.create': 'Webhook作成',
  'webhook.delete': 'Webhook削除',
  'apikey.create': 'APIキー発行',
  'apikey.delete': 'APIキー削除',
  'conversation.assign': '会話割り当て',
  'conversation.close': '会話終了',
};

export default function AuditLogPage() {
  const [, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    adminId: '',
    action: '',
    targetType: '',
  });
  const { token } = useAuthStore();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('startDate', filters.dateFrom);
      if (filters.dateTo) params.append('endDate', filters.dateTo);
      if (filters.adminId) params.append('adminId', filters.adminId);
      if (filters.action) params.append('action', filters.action);
      if (filters.targetType) params.append('entity', filters.targetType);

      const response = await fetch(`/api/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // サービスは { data: [...], pagination: {...} } を返す
        const logs = data.data || data.logs || [];
        setLogs(logs);
        setFilteredLogs(logs);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleFilter = () => {
    fetchLogs();
  };

  const handleReset = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      adminId: '',
      action: '',
      targetType: '',
    });
    setTimeout(() => fetchLogs(), 0);
  };

  const handleShowDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const getActionBadge = (action: string) => {
    const color = action.includes('delete')
      ? 'bg-red-100 text-red-700'
      : action.includes('create')
      ? 'bg-green-100 text-green-700'
      : action.includes('update')
      ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-700';

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        {ACTION_LABELS[action] || action}
      </span>
    );
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">監査ログ</h1>
          <p className="text-sm text-gray-500 mt-1">管理者の操作履歴を確認します</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">開始日</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">終了日</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">操作</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              >
                <option value="">すべて</option>
                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">対象タイプ</label>
              <select
                value={filters.targetType}
                onChange={(e) => setFilters({ ...filters, targetType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              >
                <option value="">すべて</option>
                <option value="admin">管理者</option>
                <option value="user">ユーザー</option>
                <option value="scenario">シナリオ</option>
                <option value="settings">設定</option>
                <option value="webhook">Webhook</option>
                <option value="apikey">APIキー</option>
                <option value="conversation">会話</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleFilter}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                検索
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                リセット
              </button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">日時</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作者</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">対象</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">IPアドレス</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(log.createdAt).toLocaleString('ja-JP')}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="font-medium text-gray-800">{log.adminName}</div>
                        <div className="text-xs text-gray-500">{log.adminEmail}</div>
                      </td>
                      <td className="py-3 px-4 text-sm">{getActionBadge(log.action)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <span className="capitalize">{log.targetType}</span>
                          {log.targetId && (
                            <span className="text-xs text-gray-400">({log.targetId.slice(0, 8)})</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 font-mono">
                        {log.ipAddress}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        {log.changes && (
                          <button
                            onClick={() => handleShowDetail(log)}
                            className="text-primary hover:text-primary-hover"
                          >
                            表示
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredLogs.length === 0 && (
                <div className="text-center py-12 text-gray-500">ログがありません</div>
              )}
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">操作詳細</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">日時</div>
                    <div className="text-sm text-gray-600">
                      {new Date(selectedLog.createdAt).toLocaleString('ja-JP')}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">操作者</div>
                    <div className="text-sm text-gray-600">
                      {selectedLog.adminName} ({selectedLog.adminEmail})
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">操作</div>
                    <div className="text-sm">{getActionBadge(selectedLog.action)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">対象</div>
                    <div className="text-sm text-gray-600">
                      {selectedLog.targetType}
                      {selectedLog.targetId && ` (${selectedLog.targetId})`}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">IPアドレス</div>
                    <div className="text-sm text-gray-600 font-mono">{selectedLog.ipAddress}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">User Agent</div>
                    <div className="text-sm text-gray-600 truncate" title={selectedLog.userAgent}>
                      {selectedLog.userAgent}
                    </div>
                  </div>
                </div>

                {selectedLog.changes && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">変更内容</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">変更前</div>
                        <pre className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs overflow-auto max-h-64">
                          {JSON.stringify(selectedLog.changes.before, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">変更後</div>
                        <pre className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs overflow-auto max-h-64">
                          {JSON.stringify(selectedLog.changes.after, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowDetailModal(false)}
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
