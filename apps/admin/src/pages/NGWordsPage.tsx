import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuthStore } from '../stores/authStore';

interface NGWord {
  id: string;
  word: string;
  action: 'block' | 'warn' | 'replace';
  replacement?: string;
  createdAt: string;
}

export default function NGWordsPage() {
  const { token } = useAuthStore();
  const [ngWords, setNGWords] = useState<NGWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newAction, setNewAction] = useState<'block' | 'warn' | 'replace'>('block');
  const [newReplacement, setNewReplacement] = useState('');

  // 設定を取得
  const fetchNGWords = async () => {
    try {
      const res = await fetch('/api/settings/ng_words', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // APIはvalueを直接返すので、dataがそのままvalue
        if (data && Array.isArray(data.words)) {
          setNGWords(data.words);
        }
      }
    } catch (err) {
      console.error('Failed to fetch NG words:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchNGWords();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 設定を保存
  const saveNGWords = async (words: NGWord[]) => {
    setSaving(true);
    try {
      await fetch('/api/settings/ng_words', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value: { words } }),
      });
    } catch (err) {
      console.error('Failed to save NG words:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newWord.trim()) return;

    const word: NGWord = {
      id: Date.now().toString(),
      word: newWord,
      action: newAction,
      replacement: newAction === 'replace' ? newReplacement : undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updatedWords = [word, ...ngWords];
    setNGWords(updatedWords);
    await saveNGWords(updatedWords);
    setNewWord('');
    setNewReplacement('');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('このNGワードを削除しますか？')) {
      const updatedWords = ngWords.filter((w) => w.id !== id);
      setNGWords(updatedWords);
      await saveNGWords(updatedWords);
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'block':
        return { label: 'ブロック', color: 'bg-red-100 text-red-700' };
      case 'warn':
        return { label: '警告', color: 'bg-yellow-100 text-yellow-700' };
      case 'replace':
        return { label: '置換', color: 'bg-blue-100 text-blue-700' };
      default:
        return { label: action, color: 'bg-gray-100 text-gray-700' };
    }
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">NGワード設定</h1>
          <p className="text-sm text-gray-500 mt-1">チャットで禁止するワードを管理します</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">NGワードを追加</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ワード
                  </label>
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="NGワードを入力"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    アクション
                  </label>
                  <select
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value as 'block' | 'warn' | 'replace')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  >
                    <option value="block">ブロック（送信不可）</option>
                    <option value="warn">警告（通知のみ）</option>
                    <option value="replace">置換（別の文字に）</option>
                  </select>
                </div>

                {newAction === 'replace' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      置換文字
                    </label>
                    <input
                      type="text"
                      value={newReplacement}
                      onChange={(e) => setNewReplacement(e.target.value)}
                      placeholder="***"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                )}

                <button
                  onClick={handleAdd}
                  disabled={!newWord.trim() || saving}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '保存中...' : '追加'}
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-2">アクションの説明</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li><strong>ブロック:</strong> メッセージの送信を禁止</li>
                <li><strong>警告:</strong> 管理者に通知を送信</li>
                <li><strong>置換:</strong> 指定した文字に置き換え</li>
              </ul>
            </div>
          </div>

          {/* Word List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">登録済みNGワード</h2>
                  <span className="text-sm text-gray-500">{ngWords.length}件</span>
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center text-gray-500">読み込み中...</div>
              ) : ngWords.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  NGワードが登録されていません
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {ngWords.map((word) => {
                    const actionInfo = getActionLabel(word.action);
                    return (
                      <div
                        key={word.id}
                        className="px-5 py-4 flex items-center justify-between hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="font-medium text-gray-800">{word.word}</span>
                            {word.replacement && (
                              <span className="text-sm text-gray-500 ml-2">
                                → {word.replacement}
                              </span>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${actionInfo.color}`}>
                            {actionInfo.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{word.createdAt}</span>
                          <button
                            onClick={() => handleDelete(word.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
