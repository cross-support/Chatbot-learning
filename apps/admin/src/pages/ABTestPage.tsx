import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

interface Variant {
  id: string;
  name: string;
  weight: number;
  content: Record<string, unknown>;
  impressions: number;
  conversions: number;
}

interface AbTest {
  id: string;
  name: string;
  description?: string;
  nodeId?: number;
  status: 'draft' | 'running' | 'paused' | 'completed';
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  variants: Variant[];
}

interface TestResults {
  test: {
    id: string;
    name: string;
    status: string;
    startedAt?: string;
    endedAt?: string;
  };
  control: {
    variantId: string;
    variantName: string;
    impressions: number;
    conversions: number;
    conversionRate: number;
  };
  treatments: Array<{
    variantId: string;
    variantName: string;
    impressions: number;
    conversions: number;
    conversionRate: number;
    lift: number;
  }>;
  totalParticipants: number;
}

export default function ABTestPage() {
  const { token } = useAuth();
  const [tests, setTests] = useState<AbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState<AbTest | null>(null);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTest, setNewTest] = useState({
    name: '',
    description: '',
    variants: [
      { name: 'A (コントロール)', weight: 50, content: {} },
      { name: 'B', weight: 50, content: {} },
    ],
  });

  // テスト一覧取得
  const fetchTests = async () => {
    try {
      const res = await fetch('/api/abtests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTests(data);
      }
    } catch (err) {
      console.error('Failed to fetch tests:', err);
    } finally {
      setLoading(false);
    }
  };

  // テスト結果取得
  const fetchTestResults = async (testId: string) => {
    try {
      const res = await fetch(`/api/abtests/${testId}/results`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTestResults(data);
      }
    } catch (err) {
      console.error('Failed to fetch test results:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (selectedTest) {
      fetchTestResults(selectedTest.id);
    } else {
      setTestResults(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTest]);

  // テスト作成
  const handleCreateTest = async () => {
    const totalWeight = newTest.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      alert('バリアントの配分が100%になるよう設定してください');
      return;
    }

    try {
      const res = await fetch('/api/abtests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTest),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewTest({
          name: '',
          description: '',
          variants: [
            { name: 'A (コントロール)', weight: 50, content: {} },
            { name: 'B', weight: 50, content: {} },
          ],
        });
        fetchTests();
      }
    } catch (err) {
      console.error('Failed to create test:', err);
    }
  };

  // テストステータス変更
  const handleStatusChange = async (testId: string, action: 'start' | 'pause' | 'complete') => {
    try {
      const res = await fetch(`/api/abtests/${testId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchTests();
      }
    } catch (err) {
      console.error(`Failed to ${action} test:`, err);
    }
  };

  // テスト削除
  const handleDeleteTest = async (testId: string) => {
    if (!window.confirm('このテストを削除しますか？')) return;

    try {
      const res = await fetch(`/api/abtests/${testId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setSelectedTest(null);
        fetchTests();
      }
    } catch (err) {
      console.error('Failed to delete test:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      running: 'bg-green-100 text-green-700',
      paused: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-blue-100 text-blue-700',
    };
    const labels: Record<string, string> = {
      draft: '下書き',
      running: '実行中',
      paused: '一時停止',
      completed: '完了',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">A/Bテスト</h1>
            <p className="text-sm text-gray-500 mt-1">シナリオの効果を比較検証します</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新規テスト
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* テスト一覧 */}
          <div className="col-span-4">
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-800">テスト一覧</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {tests.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    テストがありません
                  </div>
                ) : (
                  tests.map((test) => (
                    <div
                      key={test.id}
                      onClick={() => setSelectedTest(test)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedTest?.id === test.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{test.name}</span>
                        {getStatusBadge(test.status)}
                      </div>
                      <div className="text-xs text-gray-500">
                        バリアント: {test.variants?.length || 0}個
                      </div>
                      {test.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">{test.description}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* テスト詳細 */}
          <div className="col-span-8">
            {selectedTest ? (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-800">{selectedTest.name}</h2>
                    {selectedTest.description && (
                      <p className="text-sm text-gray-500 mt-1">{selectedTest.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedTest.status === 'draft' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(selectedTest.id, 'start')}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          開始
                        </button>
                        <button
                          onClick={() => handleDeleteTest(selectedTest.id)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                        >
                          削除
                        </button>
                      </>
                    )}
                    {selectedTest.status === 'running' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(selectedTest.id, 'pause')}
                          className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700"
                        >
                          一時停止
                        </button>
                        <button
                          onClick={() => handleStatusChange(selectedTest.id, 'complete')}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                        >
                          完了
                        </button>
                      </>
                    )}
                    {selectedTest.status === 'paused' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(selectedTest.id, 'start')}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          再開
                        </button>
                        <button
                          onClick={() => handleStatusChange(selectedTest.id, 'complete')}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                        >
                          完了
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 結果表示 */}
                {testResults && (
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-800">{testResults.totalParticipants}</div>
                        <div className="text-sm text-gray-500">総参加者数</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-800">
                          {testResults.control.conversionRate}%
                        </div>
                        <div className="text-sm text-gray-500">コントロール CVR</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-800">
                          {testResults.treatments[0]?.lift > 0 ? '+' : ''}{testResults.treatments[0]?.lift || 0}%
                        </div>
                        <div className="text-sm text-gray-500">最良バリアント Lift</div>
                      </div>
                    </div>

                    {/* バリアント比較 */}
                    <h3 className="font-semibold text-gray-800 mb-3">バリアント比較</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-3 font-medium text-gray-600">バリアント</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-600">表示数</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-600">コンバージョン</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-600">CVR</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-600">Lift</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <td className="py-2 px-3">{testResults.control.variantName} (コントロール)</td>
                            <td className="text-right py-2 px-3">{testResults.control.impressions}</td>
                            <td className="text-right py-2 px-3">{testResults.control.conversions}</td>
                            <td className="text-right py-2 px-3">{testResults.control.conversionRate}%</td>
                            <td className="text-right py-2 px-3 text-gray-400">-</td>
                          </tr>
                          {testResults.treatments.map((treatment) => (
                            <tr key={treatment.variantId} className="border-b border-gray-100">
                              <td className="py-2 px-3">{treatment.variantName}</td>
                              <td className="text-right py-2 px-3">{treatment.impressions}</td>
                              <td className="text-right py-2 px-3">{treatment.conversions}</td>
                              <td className="text-right py-2 px-3">{treatment.conversionRate}%</td>
                              <td className={`text-right py-2 px-3 font-medium ${
                                treatment.lift > 0 ? 'text-green-600' : treatment.lift < 0 ? 'text-red-600' : ''
                              }`}>
                                {treatment.lift > 0 ? '+' : ''}{treatment.lift}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                テストを選択してください
              </div>
            )}
          </div>
        </div>

        {/* 新規テスト作成モーダル */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">新規A/Bテスト</h3>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">テスト名</label>
                  <input
                    type="text"
                    value={newTest.name}
                    onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="例: 初回メッセージのテスト"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                  <textarea
                    value={newTest.description}
                    onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    rows={2}
                    placeholder="テストの目的を記入..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">バリアント配分</label>
                  {newTest.variants.map((variant, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={variant.name}
                        onChange={(e) => {
                          const updated = [...newTest.variants];
                          updated[idx].name = e.target.value;
                          setNewTest({ ...newTest, variants: updated });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={variant.weight}
                          onChange={(e) => {
                            const updated = [...newTest.variants];
                            updated[idx].weight = parseInt(e.target.value) || 0;
                            setNewTest({ ...newTest, variants: updated });
                          }}
                          className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center"
                          min={0}
                          max={100}
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                      {newTest.variants.length > 2 && (
                        <button
                          onClick={() => {
                            const updated = newTest.variants.filter((_, i) => i !== idx);
                            setNewTest({ ...newTest, variants: updated });
                          }}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const letter = String.fromCharCode(65 + newTest.variants.length);
                      setNewTest({
                        ...newTest,
                        variants: [...newTest.variants, { name: letter, weight: 0, content: {} }],
                      });
                    }}
                    className="text-sm text-primary hover:underline mt-2"
                  >
                    + バリアントを追加
                  </button>
                  <p className="text-xs text-gray-500 mt-1">
                    合計: {newTest.variants.reduce((sum, v) => sum + v.weight, 0)}% (100%にする必要があります)
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreateTest}
                  disabled={!newTest.name || newTest.variants.reduce((sum, v) => sum + v.weight, 0) !== 100}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
                >
                  作成
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
