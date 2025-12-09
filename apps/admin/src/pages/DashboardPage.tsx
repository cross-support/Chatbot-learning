import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface DashboardStats {
  totalConversations: number;
  npsScore: number;
  resolutionRate: number;
  avgResponseTime: number;
  dailyConversations: { date: string; count: number }[];
  hourlyConversations: { hour: number; count: number }[];
  satisfactionTrend: { date: string; score: number }[];
  operatorPerformance: {
    id: string;
    name: string;
    email: string;
    handledCount: number;
    avgResponseTime: number;
    satisfaction: number;
  }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const { token } = useAuthStore();
  const navigate = useNavigate();

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      // periodから日付範囲を計算
      const now = new Date();
      let startDate: Date;
      if (period === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      });

      const response = await fetch(`/api/statistics/dashboard?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, token]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ダッシュボード</h1>
            <p className="text-sm text-gray-500 mt-1">主要指標とパフォーマンスを確認します</p>
          </div>
          <div className="flex gap-2">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p === 'today' ? '今日' : p === 'week' ? '週間' : '月間'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : stats ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500">総会話数</div>
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-800">
                  {stats.totalConversations.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">会話</div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500">NPS</div>
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-800">{stats.npsScore}</div>
                <div className="text-xs text-gray-500 mt-1">Net Promoter Score</div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500">解決率</div>
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-800">
                  {Math.round(stats.resolutionRate * 100)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">完了率</div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500">平均応答時間</div>
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-800">
                  {formatTime(stats.avgResponseTime)}
                </div>
                <div className="text-xs text-gray-500 mt-1">初回応答時間</div>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-800">日別会話数推移（過去30日）</h2>
                <div className="h-64 flex items-end gap-1">
                  {stats.dailyConversations.map((d) => (
                    <div
                      key={d.date}
                      className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                      style={{
                        height: `${Math.max(
                          4,
                          (d.count / Math.max(...stats.dailyConversations.map((h) => h.count), 1)) * 100
                        )}%`,
                      }}
                      title={`${d.date}: ${d.count}件`}
                    ></div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>{stats.dailyConversations[0]?.date.slice(5)}</span>
                  <span>過去30日</span>
                  <span>{stats.dailyConversations[stats.dailyConversations.length - 1]?.date.slice(5)}</span>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-800">時間帯別会話数</h2>
                <div className="h-64 flex items-end gap-1">
                  {stats.hourlyConversations.map((d) => (
                    <div
                      key={d.hour}
                      className="flex-1 bg-green-500 rounded-t hover:bg-green-600 transition-colors cursor-pointer"
                      style={{
                        height: `${Math.max(
                          4,
                          (d.count / Math.max(...stats.hourlyConversations.map((h) => h.count), 1)) * 100
                        )}%`,
                      }}
                      title={`${d.hour}時: ${d.count}件`}
                    ></div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>0時</span>
                  <span>6時</span>
                  <span>12時</span>
                  <span>18時</span>
                  <span>24時</span>
                </div>
              </div>
            </div>

            {/* Satisfaction Trend */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">満足度推移</h2>
              <div className="h-64 relative">
                <div className="absolute inset-0 flex items-end">
                  {stats.satisfactionTrend.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div
                        className="w-full bg-purple-500 rounded-t hover:bg-purple-600 transition-colors cursor-pointer"
                        style={{
                          height: `${Math.max(4, d.score * 20)}%`,
                        }}
                        title={`${d.date}: ${d.score.toFixed(1)}点`}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                {stats.satisfactionTrend.map((d) => (
                  <span key={d.date}>{d.date.slice(5)}</span>
                ))}
              </div>
              <div className="mt-4 text-sm text-gray-600 text-center">
                5段階評価の平均スコア
              </div>
            </div>

            {/* Operator Performance */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">オペレーター別パフォーマンス</h2>
                <button
                  onClick={() => navigate('/statistics/operators')}
                  className="text-sm text-primary hover:text-primary-hover font-medium"
                >
                  詳細を見る →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">名前</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">メール</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">対応件数</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">平均応答時間</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">満足度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.operatorPerformance.map((op) => (
                      <tr key={op.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-800">{op.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{op.email}</td>
                        <td className="py-3 px-4 text-sm text-gray-800 text-right">
                          {op.handledCount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800 text-right">
                          {formatTime(op.avgResponseTime)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-yellow-500">★</span>
                            <span className="text-gray-800 font-medium">
                              {op.satisfaction.toFixed(1)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stats.operatorPerformance.length === 0 && (
                  <div className="text-center py-8 text-gray-500">データがありません</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">データがありません</div>
        )}
      </div>
    </Layout>
  );
}
