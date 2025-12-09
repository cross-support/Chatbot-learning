import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface Statistics {
  totalConversations: number;
  todayConversations: number;
  waitingCount: number;
  activeCount: number;
  closedCount: number;
  botHandledCount: number;
  humanHandledCount: number;
  avgResponseTime: number;
  avgHandleTime: number;
  hourlyData: { hour: number; count: number }[];
  dailyData: { date: string; count: number }[];
}

interface InquiryStatistics {
  totalInquiries: number;
  pendingCount: number;
  inProgressCount: number;
  resolvedCount: number;
  avgResolutionTime: number;
  dailyData: { date: string; count: number }[];
}

export default function StatisticsPage() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [inquiryStats, setInquiryStats] = useState<InquiryStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const { token } = useAuthStore();

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      // 統計専用APIを使用（サーバーサイドで計算、パフォーマンス改善）
      const response = await fetch(`/api/conversations/statistics?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      setStats({
        totalConversations: data.totalConversations,
        todayConversations: data.periodConversations,
        waitingCount: data.waitingCount,
        activeCount: data.activeCount,
        closedCount: data.closedCount,
        botHandledCount: data.botHandledCount,
        humanHandledCount: data.humanHandledCount,
        avgResponseTime: data.avgResponseTime,
        avgHandleTime: data.avgHandleTime,
        hourlyData: data.hourlyData,
        dailyData: data.dailyData,
      });
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  // 時間外問い合わせ統計を取得
  const fetchInquiryStatistics = async () => {
    try {
      const response = await fetch('/api/off-hours-inquiries?limit=1000', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const inquiries = data.items || [];

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const pending = inquiries.filter((i: { status: string }) => i.status === 'PENDING').length;
      const inProgress = inquiries.filter((i: { status: string }) => i.status === 'IN_PROGRESS').length;
      const resolved = inquiries.filter((i: { status: string }) => i.status === 'RESOLVED').length;

      // 解決時間の平均を計算
      const resolvedInquiries = inquiries.filter(
        (i: { status: string; createdAt: string; resolvedAt?: string }) =>
          i.status === 'RESOLVED' && i.resolvedAt
      );

      let avgResolutionTime = 0;
      if (resolvedInquiries.length > 0) {
        const totalTime = resolvedInquiries.reduce(
          (sum: number, i: { createdAt: string; resolvedAt: string }) => {
            const start = new Date(i.createdAt).getTime();
            const end = new Date(i.resolvedAt).getTime();
            return sum + (end - start) / 1000 / 60; // 分に変換
          },
          0
        );
        avgResolutionTime = Math.round(totalTime / resolvedInquiries.length);
      }

      // 日別データ（過去7日）
      const dailyData = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        return {
          date: dateStr,
          count: inquiries.filter((inq: { createdAt: string }) => {
            const cDate = new Date(inq.createdAt).toISOString().split('T')[0];
            return cDate === dateStr;
          }).length,
        };
      }).reverse();

      setInquiryStats({
        totalInquiries: inquiries.length,
        pendingCount: pending,
        inProgressCount: inProgress,
        resolvedCount: resolved,
        avgResolutionTime,
        dailyData,
      });
    } catch (error) {
      console.error('Failed to fetch inquiry statistics:', error);
    }
  };

  useEffect(() => {
    fetchStatistics();
    fetchInquiryStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, token]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  };

  // 会話データをエクスポート
  const handleExport = (format: 'json' | 'csv', status?: string) => {
    const params = new URLSearchParams();
    params.set('format', format);
    if (status && status !== 'all') params.set('status', status);
    if (exportFrom) params.set('from', exportFrom);
    if (exportTo) params.set('to', exportTo);

    window.open(`/api/conversations/export/all?${params.toString()}`, '_blank');
    setExportStatus('ダウンロードを開始しました');
    setTimeout(() => setExportStatus(null), 3000);
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">統計ダッシュボード</h1>
            <p className="text-sm text-gray-500 mt-1">チャットの統計情報を確認します</p>
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
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              エクスポート
            </button>
          </div>
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">会話データをエクスポート</h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">期間</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={exportFrom}
                      onChange={(e) => setExportFrom(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="開始日"
                    />
                    <span className="flex items-center text-gray-500">〜</span>
                    <input
                      type="date"
                      value={exportTo}
                      onChange={(e) => setExportTo(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="終了日"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">未指定の場合は全期間</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">エクスポート形式</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleExport('json')}
                      className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-center"
                    >
                      <div className="text-2xl mb-1">📋</div>
                      <div className="text-sm font-medium text-blue-700">JSON形式</div>
                      <div className="text-xs text-gray-500">詳細データ向け</div>
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-center"
                    >
                      <div className="text-2xl mb-1">📊</div>
                      <div className="text-sm font-medium text-green-700">CSV形式</div>
                      <div className="text-xs text-gray-500">Excel向け</div>
                    </button>
                  </div>
                </div>

                {exportStatus && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    {exportStatus}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div>
        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : stats ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-sm text-gray-500">総会話数</div>
                <div className="text-3xl font-bold text-gray-800">{stats.totalConversations}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-sm text-gray-500">
                  {period === 'today' ? '今日' : period === 'week' ? '今週' : '今月'}の会話
                </div>
                <div className="text-3xl font-bold text-primary">{stats.todayConversations}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-sm text-gray-500">平均初回応答時間</div>
                <div className="text-3xl font-bold text-blue-600">{formatTime(stats.avgResponseTime)}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-sm text-gray-500">平均対応時間</div>
                <div className="text-3xl font-bold text-green-600">{formatTime(stats.avgHandleTime)}</div>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">ステータス別</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                      <span>未対応</span>
                    </div>
                    <span className="font-semibold">{stats.waitingCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      <span>対応中</span>
                    </div>
                    <span className="font-semibold">{stats.activeCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                      <span>BOT対応中</span>
                    </div>
                    <span className="font-semibold">{stats.botHandledCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-gray-500 rounded-full"></span>
                      <span>完了</span>
                    </div>
                    <span className="font-semibold">{stats.closedCount}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">対応比率</h2>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>BOT自動対応</span>
                      <span>
                        {stats.totalConversations > 0
                          ? Math.round((stats.botHandledCount / stats.totalConversations) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{
                          width: `${
                            stats.totalConversations > 0
                              ? (stats.botHandledCount / stats.totalConversations) * 100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>有人対応</span>
                      <span>
                        {stats.totalConversations > 0
                          ? Math.round((stats.humanHandledCount / stats.totalConversations) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width: `${
                            stats.totalConversations > 0
                              ? (stats.humanHandledCount / stats.totalConversations) * 100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">時間帯別会話数</h2>
                <div className="h-48 flex items-end gap-1">
                  {stats.hourlyData.map((d) => (
                    <div
                      key={d.hour}
                      className="flex-1 bg-primary/80 rounded-t hover:bg-primary transition-colors"
                      style={{
                        height: `${Math.max(
                          4,
                          (d.count / Math.max(...stats.hourlyData.map((h) => h.count), 1)) * 100
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

              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">日別会話数（過去7日）</h2>
                <div className="h-48 flex items-end gap-2">
                  {stats.dailyData.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-green-500/80 rounded-t hover:bg-green-500 transition-colors"
                        style={{
                          height: `${Math.max(
                            8,
                            (d.count / Math.max(...stats.dailyData.map((h) => h.count), 1)) * 100
                          )}%`,
                        }}
                        title={`${d.date}: ${d.count}件`}
                      ></div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  {stats.dailyData.map((d) => (
                    <span key={d.date}>{d.date.slice(5)}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* 時間外問い合わせ統計 */}
            {inquiryStats && (
              <>
                <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">時間外問い合わせ統計</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow-sm p-4">
                    <div className="text-sm text-gray-500">総問い合わせ数</div>
                    <div className="text-3xl font-bold text-gray-800">{inquiryStats.totalInquiries}</div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm p-4">
                    <div className="text-sm text-gray-500">未対応</div>
                    <div className="text-3xl font-bold text-red-600">{inquiryStats.pendingCount}</div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm p-4">
                    <div className="text-sm text-gray-500">対応中</div>
                    <div className="text-3xl font-bold text-yellow-600">{inquiryStats.inProgressCount}</div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm p-4">
                    <div className="text-sm text-gray-500">対応完了</div>
                    <div className="text-3xl font-bold text-green-600">{inquiryStats.resolvedCount}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">問い合わせ対応状況</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>未対応</span>
                          <span>
                            {inquiryStats.totalInquiries > 0
                              ? Math.round((inquiryStats.pendingCount / inquiryStats.totalInquiries) * 100)
                              : 0}
                            %
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500"
                            style={{
                              width: `${
                                inquiryStats.totalInquiries > 0
                                  ? (inquiryStats.pendingCount / inquiryStats.totalInquiries) * 100
                                  : 0
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>対応中</span>
                          <span>
                            {inquiryStats.totalInquiries > 0
                              ? Math.round((inquiryStats.inProgressCount / inquiryStats.totalInquiries) * 100)
                              : 0}
                            %
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500"
                            style={{
                              width: `${
                                inquiryStats.totalInquiries > 0
                                  ? (inquiryStats.inProgressCount / inquiryStats.totalInquiries) * 100
                                  : 0
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>対応完了</span>
                          <span>
                            {inquiryStats.totalInquiries > 0
                              ? Math.round((inquiryStats.resolvedCount / inquiryStats.totalInquiries) * 100)
                              : 0}
                            %
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${
                                inquiryStats.totalInquiries > 0
                                  ? (inquiryStats.resolvedCount / inquiryStats.totalInquiries) * 100
                                  : 0
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    {inquiryStats.avgResolutionTime > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-500">平均対応完了時間</div>
                        <div className="text-2xl font-bold text-primary">
                          {inquiryStats.avgResolutionTime < 60
                            ? `${inquiryStats.avgResolutionTime}分`
                            : `${Math.floor(inquiryStats.avgResolutionTime / 60)}時間${inquiryStats.avgResolutionTime % 60}分`}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">日別問い合わせ数（過去7日）</h3>
                    <div className="h-48 flex items-end gap-2">
                      {inquiryStats.dailyData.map((d) => (
                        <div key={d.date} className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full bg-orange-500/80 rounded-t hover:bg-orange-500 transition-colors"
                            style={{
                              height: `${Math.max(
                                8,
                                (d.count / Math.max(...inquiryStats.dailyData.map((h) => h.count), 1)) * 100
                              )}%`,
                            }}
                            title={`${d.date}: ${d.count}件`}
                          ></div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      {inquiryStats.dailyData.map((d) => (
                        <span key={d.date}>{d.date.slice(5)}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">データがありません</div>
        )}
        </div>
      </div>
    </Layout>
  );
}
