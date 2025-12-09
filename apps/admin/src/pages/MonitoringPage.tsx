import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { apiRequest } from '../services/api';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: { status: string; latency?: number; error?: string };
    memory: { status: string; used: number; total: number; percentage: number };
  };
}

interface SystemMetrics {
  conversations: {
    total: number;
    active: number;
    waiting: number;
    closedToday: number;
  };
  messages: {
    totalToday: number;
    byType: Record<string, number>;
  };
  users: {
    total: number;
    activeToday: number;
  };
  operators: {
    online: number;
    busy: number;
    away: number;
    offline: number;
  };
  webhooks: {
    pending: number;
    failed: number;
    successRate: number;
  };
  inquiries: {
    pending: number;
    inProgress: number;
  };
}

export default function MonitoringPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [healthData, metricsData] = await Promise.all([
        apiRequest<HealthStatus>('/api/monitoring/health'),
        apiRequest<SystemMetrics>('/api/monitoring/metrics'),
      ]);
      setHealth(healthData);
      setMetrics(metricsData);
      setError(null);
    } catch (err) {
      setError('データの取得に失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 30秒ごとに自動更新
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}日 ${hours}時間`;
    if (hours > 0) return `${hours}時間 ${minutes}分`;
    return `${minutes}分`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return 'bg-green-100 text-green-800';
      case 'degraded':
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy':
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-6">
          <div className="p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
            <button
              onClick={fetchData}
              className="ml-4 text-red-600 underline hover:no-underline"
            >
              再試行
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">システム監視</h1>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          更新
        </button>
      </div>

      {/* ヘルスステータス */}
      {health && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">システムステータス</h2>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.status)}`}
            >
              {health.status === 'healthy'
                ? '正常'
                : health.status === 'degraded'
                  ? '注意'
                  : '異常'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">バージョン</p>
              <p className="text-lg font-semibold">{health.version}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">稼働時間</p>
              <p className="text-lg font-semibold">{formatUptime(health.uptime)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">データベース</p>
              <p className="text-lg font-semibold">
                {health.checks.database.latency
                  ? `${health.checks.database.latency}ms`
                  : health.checks.database.error || 'エラー'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">メモリ使用率</p>
              <p className="text-lg font-semibold">{health.checks.memory.percentage}%</p>
              <div className="mt-1 h-2 bg-gray-200 rounded-full">
                <div
                  className={`h-2 rounded-full ${
                    health.checks.memory.percentage > 90
                      ? 'bg-red-500'
                      : health.checks.memory.percentage > 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${health.checks.memory.percentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* メトリクス */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 会話統計 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">会話</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">合計</span>
                <span className="font-semibold">{metrics.conversations.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">アクティブ</span>
                <span className="font-semibold text-green-600">
                  {metrics.conversations.active}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">待機中</span>
                <span className="font-semibold text-yellow-600">
                  {metrics.conversations.waiting}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">本日クローズ</span>
                <span className="font-semibold">{metrics.conversations.closedToday}</span>
              </div>
            </div>
          </div>

          {/* メッセージ統計 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">本日のメッセージ</h3>
            <div className="text-3xl font-bold text-blue-600 mb-4">
              {metrics.messages.totalToday.toLocaleString()}
            </div>
            <div className="space-y-2">
              {Object.entries(metrics.messages.byType).map(([type, count]) => (
                <div key={type} className="flex justify-between text-sm">
                  <span className="text-gray-600">{type}</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ユーザー統計 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">ユーザー</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">合計</span>
                <span className="font-semibold">{metrics.users.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">本日アクティブ</span>
                <span className="font-semibold text-blue-600">{metrics.users.activeToday}</span>
              </div>
            </div>
          </div>

          {/* オペレーター統計 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">オペレーター</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">{metrics.operators.online}</div>
                <div className="text-xs text-gray-600">オンライン</div>
              </div>
              <div className="text-center p-2 bg-yellow-50 rounded">
                <div className="text-2xl font-bold text-yellow-600">{metrics.operators.busy}</div>
                <div className="text-xs text-gray-600">対応中</div>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded">
                <div className="text-2xl font-bold text-orange-600">{metrics.operators.away}</div>
                <div className="text-xs text-gray-600">離席</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-2xl font-bold text-gray-600">{metrics.operators.offline}</div>
                <div className="text-xs text-gray-600">オフライン</div>
              </div>
            </div>
          </div>

          {/* Webhook統計 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Webhook</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">成功率</span>
                <span
                  className={`font-semibold ${
                    metrics.webhooks.successRate >= 95
                      ? 'text-green-600'
                      : metrics.webhooks.successRate >= 80
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}
                >
                  {metrics.webhooks.successRate}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">保留中</span>
                <span className="font-semibold">{metrics.webhooks.pending}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">失敗</span>
                <span className="font-semibold text-red-600">{metrics.webhooks.failed}</span>
              </div>
            </div>
          </div>

          {/* 問い合わせ統計 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">時間外問い合わせ</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">未対応</span>
                <span
                  className={`font-semibold ${
                    metrics.inquiries.pending > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {metrics.inquiries.pending}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">対応中</span>
                <span className="font-semibold text-yellow-600">{metrics.inquiries.inProgress}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </Layout>
  );
}
