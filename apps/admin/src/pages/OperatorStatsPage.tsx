import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface OperatorStats {
  id: string;
  name: string;
  email: string;
  handledCount: number;
  avgResponseTime: number;
  avgHandleTime: number;
  satisfaction: number;
  totalSatisfactionRatings: number;
  onlineHours: number;
  rank: number;
}

export default function OperatorStatsPage() {
  const [operators, setOperators] = useState<OperatorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [sortBy, setSortBy] = useState<'handledCount' | 'avgResponseTime' | 'satisfaction'>('handledCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { token } = useAuthStore();

  const fetchOperatorStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/statistics/operators?period=${period}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOperators(data.operators || []);
      }
    } catch (error) {
      console.error('Failed to fetch operator stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperatorStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, token]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const sortedOperators = [...operators].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="flex items-center gap-1 text-yellow-600">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="font-bold">1位</span>
        </div>
      );
    } else if (rank === 2) {
      return (
        <div className="flex items-center gap-1 text-gray-400">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="font-bold">2位</span>
        </div>
      );
    } else if (rank === 3) {
      return (
        <div className="flex items-center gap-1 text-orange-600">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="font-bold">3位</span>
        </div>
      );
    }
    return <span className="text-gray-600 font-medium">{rank}位</span>;
  };

  const SortIcon = ({ column }: { column: typeof sortBy }) => {
    if (sortBy !== column) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">オペレーター統計</h1>
            <p className="text-sm text-gray-500 mt-1">オペレーター別のパフォーマンスを確認します</p>
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
        ) : (
          <>
            {/* Top 3 Ranking */}
            {sortedOperators.length >= 3 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {sortedOperators.slice(0, 3).map((op, index) => {
                  const colors = [
                    'border-yellow-500 bg-yellow-50',
                    'border-gray-400 bg-gray-50',
                    'border-orange-500 bg-orange-50',
                  ];
                  return (
                    <div
                      key={op.id}
                      className={`bg-white rounded-lg shadow-sm p-6 border-l-4 ${colors[index]}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        {getRankBadge(index + 1)}
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-800 mb-1">{op.name}</div>
                        <div className="text-sm text-gray-500 mb-3">{op.email}</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-gray-500">対応件数</div>
                            <div className="text-xl font-bold text-primary">
                              {op.handledCount}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">満足度</div>
                            <div className="text-xl font-bold text-yellow-500">
                              {op.satisfaction.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Detailed Table */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                        順位
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                        名前
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                        メール
                      </th>
                      <th
                        className="text-right py-3 px-4 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('handledCount')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>対応件数</span>
                          <SortIcon column="handledCount" />
                        </div>
                      </th>
                      <th
                        className="text-right py-3 px-4 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('avgResponseTime')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>平均応答時間</span>
                          <SortIcon column="avgResponseTime" />
                        </div>
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">
                        平均対応時間
                      </th>
                      <th
                        className="text-right py-3 px-4 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('satisfaction')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>満足度</span>
                          <SortIcon column="satisfaction" />
                        </div>
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">
                        評価数
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">
                        稼働時間
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOperators.map((op, index) => (
                      <tr
                        key={op.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm">
                          {getRankBadge(index + 1)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">
                          {op.name}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{op.email}</td>
                        <td className="py-3 px-4 text-sm text-gray-800 text-right font-medium">
                          {op.handledCount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800 text-right">
                          {formatTime(op.avgResponseTime)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800 text-right">
                          {formatTime(op.avgHandleTime)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-yellow-500">★</span>
                            <span className="text-gray-800 font-medium">
                              {op.satisfaction.toFixed(1)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 text-right">
                          {op.totalSatisfactionRatings}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 text-right">
                          {op.onlineHours.toFixed(1)}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedOperators.length === 0 && (
                  <div className="text-center py-12 text-gray-500">データがありません</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
