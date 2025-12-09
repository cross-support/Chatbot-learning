import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuthStore } from '../stores/authStore';

interface FAQ {
  id: string;
  question: string;
  answer: string | null;
  frequency: number;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FAQStats {
  total: number;
  approved: number;
  pending: number;
  topFaqs: FAQ[];
}

export default function FaqPage() {
  const { token } = useAuthStore();
  const [tabValue, setTabValue] = useState<'approved' | 'pending'>('approved');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [suggestions, setSuggestions] = useState<FAQ[]>([]);
  const [stats, setStats] = useState<FAQStats | null>(null);
  const [sortBy, setSortBy] = useState('frequency');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 新規追加モーダル
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  // 編集モーダル
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');

  useEffect(() => {
    loadData();
  }, [tabValue, sortBy]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      if (tabValue === 'approved') {
        const res = await fetch('/api/faq?approved=true', { headers });
        const data = await res.json();
        setFaqs(data);
      } else {
        const res = await fetch(`/api/faq/suggestions?sortBy=${sortBy}`, { headers });
        const data = await res.json();
        setSuggestions(data);
      }

      // 統計情報取得
      const statsRes = await fetch('/api/faq/stats', { headers });
      const statsData = await statsRes.json();
      setStats(statsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFaq = async () => {
    if (!newQuestion || !newAnswer) {
      setError('質問と回答を入力してください');
      return;
    }

    try {
      await fetch('/api/faq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: newQuestion, answer: newAnswer }),
      });
      setSuccess('FAQを追加しました');
      setAddModalOpen(false);
      setNewQuestion('');
      setNewAnswer('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'FAQの追加に失敗しました');
    }
  };

  const handleApproveSuggestion = async (id: string) => {
    try {
      await fetch(`/api/faq/suggestions/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess('提案を承認しました');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '承認に失敗しました');
    }
  };

  const handleRejectSuggestion = async (id: string) => {
    if (!window.confirm('この提案を却下しますか?')) return;

    try {
      await fetch(`/api/faq/suggestions/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess('提案を却下しました');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '却下に失敗しました');
    }
  };

  const handleEditFaq = (faq: FAQ) => {
    setEditingFaq(faq);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer || '');
    setEditModalOpen(true);
  };

  const handleUpdateFaq = async () => {
    if (!editingFaq || !editQuestion || !editAnswer) {
      setError('質問と回答を入力してください');
      return;
    }

    try {
      await fetch(`/api/faq/${editingFaq.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: editQuestion, answer: editAnswer }),
      });
      setSuccess('FAQを更新しました');
      setEditModalOpen(false);
      setEditingFaq(null);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'FAQの更新に失敗しました');
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!window.confirm('このFAQを削除しますか?')) return;

    try {
      await fetch(`/api/faq/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess('FAQを削除しました');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'FAQの削除に失敗しました');
    }
  };

  const currentFaqs = tabValue === 'approved' ? faqs : suggestions;

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">FAQ管理</h1>
            <p className="text-sm text-gray-500 mt-1">よくある質問を管理します</p>
          </div>
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            FAQ追加
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between">
            {error}
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex justify-between">
            {success}
            <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">×</button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-sm text-gray-500">総FAQ数</div>
              <div className="text-3xl font-bold text-gray-800">{stats.total}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-sm text-gray-500">承認済み</div>
              <div className="text-3xl font-bold text-green-600">{stats.approved}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-sm text-gray-500">未承認</div>
              <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setTabValue('approved')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  tabValue === 'approved'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                承認済みFAQ
              </button>
              <button
                onClick={() => setTabValue('pending')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  tabValue === 'pending'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                未承認の提案
              </button>
            </nav>
          </div>

          <div className="p-4">
            {tabValue === 'pending' && (
              <div className="mb-4">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="frequency">頻度順</option>
                  <option value="createdAt">作成日時順</option>
                  <option value="updatedAt">更新日時順</option>
                </select>
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-gray-500">読み込み中...</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">質問</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">回答</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-600 w-20">頻度</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-600 w-24">ステータス</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 w-32">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {currentFaqs.map((faq) => (
                    <tr key={faq.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-800">{faq.question}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-500">{faq.answer || '(回答未設定)'}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          faq.frequency > 10 ? 'bg-red-100 text-red-700' :
                          faq.frequency > 5 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {faq.frequency}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          faq.isApproved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {faq.isApproved ? '承認済み' : '未承認'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!faq.isApproved ? (
                          <>
                            <button
                              onClick={() => handleApproveSuggestion(faq.id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="承認"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRejectSuggestion(faq.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="却下"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEditFaq(faq)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="編集"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteFaq(faq.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="削除"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {currentFaqs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        データがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Add Modal */}
        {addModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
              <h3 className="text-lg font-semibold mb-4">FAQ追加</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">質問</label>
                  <textarea
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">回答</label>
                  <textarea
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddFaq}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
              <h3 className="text-lg font-semibold mb-4">FAQ編集</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">質問</label>
                  <textarea
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">回答</label>
                  <textarea
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleUpdateFaq}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  更新
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
