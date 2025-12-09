import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface SentimentStats {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
}

interface TopicData {
  topic: string;
  count: number;
}

interface TrendData {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

interface ConversationQuality {
  conversationId: string;
  sentiment: string;
  summary: string;
  topics: string[];
  createdAt: string;
}

export default function AnalyticsPage() {
  const [sentimentStats, setSentimentStats] = useState<SentimentStats | null>(null);
  const [topicData, setTopicData] = useState<TopicData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [recentInsights, setRecentInsights] = useState<ConversationQuality[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [analyzing, setAnalyzing] = useState(false);
  const { token } = useAuthStore();

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // センチメント統計を取得
      const now = new Date();
      let startDate: Date;
      if (period === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      }

      const [sentimentRes, topicsRes] = await Promise.all([
        fetch(`/api/insights/sentiment-stats?startDate=${startDate.toISOString()}&endDate=${now.toISOString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/insights/topics?limit=15', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (sentimentRes.ok) {
        const data = await sentimentRes.json();
        setSentimentStats(data);
      }

      if (topicsRes.ok) {
        const data = await topicsRes.json();
        setTopicData(data);
      }

      // センチメント推移を取得
      const daysForTrend = period === 'week' ? 7 : period === 'month' ? 30 : 90;
      const trendRes = await fetch(`/api/insights/sentiment-trend?days=${daysForTrend}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (trendRes.ok) {
        const trendDataFromApi = await trendRes.json();
        setTrendData(trendDataFromApi);
      }

      // 最近のインサイトを取得（実際のAPIがあれば置き換え）
      setRecentInsights([]);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const runBulkAnalysis = async () => {
    setAnalyzing(true);
    try {
      // 最近の会話を分析
      const response = await fetch('/api/insights/faq/extract', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await fetchAnalytics();
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, token]);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-500';
      case 'negative':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getSentimentBgColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-50 border-green-200';
      case 'negative':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">AIインサイト分析</h1>
            <p className="text-sm text-gray-500 mt-1">会話内容のセンチメント・トピック分析</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['week', 'month', 'quarter'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p === 'week' ? '週間' : p === 'month' ? '月間' : '四半期'}
              </button>
            ))}
            <button
              onClick={runBulkAnalysis}
              disabled={analyzing}
              className="px-3 md:px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="hidden md:inline">分析中...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="hidden md:inline">一括分析</span>
                </>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : (
          <>
            {/* Sentiment Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border-l-4 border-blue-500">
                <div className="text-sm text-gray-500 mb-1">総分析数</div>
                <div className="text-2xl md:text-3xl font-bold text-gray-800">
                  {sentimentStats?.total || 0}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border-l-4 border-green-500">
                <div className="text-sm text-gray-500 mb-1">ポジティブ</div>
                <div className="text-2xl md:text-3xl font-bold text-green-600">
                  {sentimentStats?.positive || 0}
                </div>
                <div className="text-xs text-gray-400">
                  {sentimentStats?.total ? Math.round((sentimentStats.positive / sentimentStats.total) * 100) : 0}%
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border-l-4 border-gray-400">
                <div className="text-sm text-gray-500 mb-1">ニュートラル</div>
                <div className="text-2xl md:text-3xl font-bold text-gray-600">
                  {sentimentStats?.neutral || 0}
                </div>
                <div className="text-xs text-gray-400">
                  {sentimentStats?.total ? Math.round((sentimentStats.neutral / sentimentStats.total) * 100) : 0}%
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border-l-4 border-red-500">
                <div className="text-sm text-gray-500 mb-1">ネガティブ</div>
                <div className="text-2xl md:text-3xl font-bold text-red-600">
                  {sentimentStats?.negative || 0}
                </div>
                <div className="text-xs text-gray-400">
                  {sentimentStats?.total ? Math.round((sentimentStats.negative / sentimentStats.total) * 100) : 0}%
                </div>
              </div>
            </div>

            {/* Sentiment Distribution & Topics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Sentiment Distribution */}
              <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-800">センチメント分布</h2>
                {sentimentStats && sentimentStats.total > 0 ? (
                  <>
                    <div className="h-8 flex rounded-lg overflow-hidden mb-4">
                      <div
                        className="bg-green-500 transition-all"
                        style={{ width: `${(sentimentStats.positive / sentimentStats.total) * 100}%` }}
                        title={`ポジティブ: ${sentimentStats.positive}`}
                      />
                      <div
                        className="bg-gray-400 transition-all"
                        style={{ width: `${(sentimentStats.neutral / sentimentStats.total) * 100}%` }}
                        title={`ニュートラル: ${sentimentStats.neutral}`}
                      />
                      <div
                        className="bg-red-500 transition-all"
                        style={{ width: `${(sentimentStats.negative / sentimentStats.total) * 100}%` }}
                        title={`ネガティブ: ${sentimentStats.negative}`}
                      />
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span>ポジティブ ({Math.round((sentimentStats.positive / sentimentStats.total) * 100)}%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-400 rounded"></div>
                        <span>ニュートラル ({Math.round((sentimentStats.neutral / sentimentStats.total) * 100)}%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                        <span>ネガティブ ({Math.round((sentimentStats.negative / sentimentStats.total) * 100)}%)</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">データがありません</div>
                )}
              </div>

              {/* Topic Analysis */}
              <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-800">トピック分析</h2>
                {topicData.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {topicData.map((topic, index) => {
                      const maxCount = topicData[0]?.count || 1;
                      return (
                        <div key={topic.topic}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700 truncate mr-2">{topic.topic}</span>
                            <span className="text-gray-500 whitespace-nowrap">{topic.count}件</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                index === 0 ? 'bg-primary' : index < 3 ? 'bg-primary/70' : 'bg-primary/40'
                              }`}
                              style={{ width: `${(topic.count / maxCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">トピックデータがありません</div>
                )}
              </div>
            </div>

            {/* Trend Chart */}
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">センチメント推移</h2>
              {trendData.length > 0 ? (
                <>
                  <div className="h-48 md:h-64 flex items-end gap-1 md:gap-2">
                    {trendData.map((d) => {
                      const total = d.positive + d.neutral + d.negative;
                      const maxTotal = Math.max(...trendData.map((t) => t.positive + t.neutral + t.negative));
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full flex flex-col rounded-t overflow-hidden"
                            style={{ height: `${(total / maxTotal) * 100}%`, minHeight: '20px' }}
                          >
                            <div
                              className="bg-green-500"
                              style={{ height: `${(d.positive / total) * 100}%` }}
                            />
                            <div
                              className="bg-gray-400"
                              style={{ height: `${(d.neutral / total) * 100}%` }}
                            />
                            <div
                              className="bg-red-500"
                              style={{ height: `${(d.negative / total) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500 overflow-x-auto">
                    {trendData.map((d) => (
                      <span key={d.date} className="whitespace-nowrap px-1">{d.date.slice(5)}</span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">トレンドデータがありません</div>
              )}
            </div>

            {/* Recent Insights */}
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">最近の分析結果</h2>
              {recentInsights.length > 0 ? (
                <div className="space-y-3">
                  {recentInsights.map((insight) => (
                    <div
                      key={insight.conversationId}
                      className={`p-4 rounded-lg border ${getSentimentBgColor(insight.sentiment)}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${getSentimentColor(insight.sentiment)}`}
                          />
                          <span className="text-sm font-medium capitalize">{insight.sentiment}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(insight.createdAt).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{insight.summary}</p>
                      <div className="flex flex-wrap gap-1">
                        {insight.topics.map((topic) => (
                          <span
                            key={topic}
                            className="px-2 py-0.5 bg-white/50 rounded text-xs text-gray-600"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-sm">「一括分析」ボタンで会話を分析してください</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
