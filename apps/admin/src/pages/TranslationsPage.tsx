import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

interface Translation {
  id: string;
  locale: string;
  namespace: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

const locales = [
  { code: 'ja', name: '日本語' },
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
];

const namespaces = [
  { code: 'common', name: '共通' },
  { code: 'chat', name: 'チャット' },
  { code: 'admin', name: '管理画面' },
  { code: 'bot', name: 'ボット' },
];

export default function TranslationsPage() {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [filteredTranslations, setFilteredTranslations] = useState<Translation[]>([]);
  const [filterLocale, setFilterLocale] = useState<string>('all');
  const [filterNamespace, setFilterNamespace] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTranslation, setEditingTranslation] = useState<Translation | null>(null);

  const [formData, setFormData] = useState({
    locale: 'ja',
    namespace: 'common',
    key: '',
    value: '',
  });

  useEffect(() => {
    loadTranslations();
  }, []);

  useEffect(() => {
    filterTranslationsList();
  }, [translations, filterLocale, filterNamespace]);

  const loadTranslations = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/i18n', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('データの取得に失敗しました');
      const data = await res.json();
      setTranslations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const filterTranslationsList = () => {
    let filtered = [...translations];

    if (filterLocale !== 'all') {
      filtered = filtered.filter((t) => t.locale === filterLocale);
    }

    if (filterNamespace !== 'all') {
      filtered = filtered.filter((t) => t.namespace === filterNamespace);
    }

    setFilteredTranslations(filtered);
  };

  const handleCreate = async () => {
    if (!formData.key || !formData.value) {
      setError('キーと値を入力してください');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/i18n', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('追加に失敗しました');
      setSuccess('翻訳を追加しました');
      setDialogOpen(false);
      resetForm();
      loadTranslations();
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました');
    }
  };

  const handleEdit = (translation: Translation) => {
    setEditingTranslation(translation);
    setFormData({
      locale: translation.locale,
      namespace: translation.namespace,
      key: translation.key,
      value: translation.value,
    });
    setDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingTranslation || !formData.value) {
      setError('値を入力してください');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/i18n/${editingTranslation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value: formData.value }),
      });
      if (!res.ok) throw new Error('更新に失敗しました');
      setSuccess('翻訳を更新しました');
      setDialogOpen(false);
      setEditingTranslation(null);
      resetForm();
      loadTranslations();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('この翻訳を削除しますか?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/i18n/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('削除に失敗しました');
      setSuccess('翻訳を削除しました');
      loadTranslations();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(translations, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translations.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFormData({
      locale: 'ja',
      namespace: 'common',
      key: '',
      value: '',
    });
  };

  const getLocaleName = (code: string) => {
    return locales.find((l) => l.code === code)?.name || code;
  };

  const getNamespaceName = (code: string) => {
    return namespaces.find((n) => n.code === code)?.name || code;
  };

  return (
    <Layout>
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">翻訳管理</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            エクスポート
          </button>
          <button
            onClick={() => {
              resetForm();
              setEditingTranslation(null);
              setDialogOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            翻訳追加
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Filter and Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex gap-4">
          <select
            value={filterLocale}
            onChange={(e) => setFilterLocale(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">すべての言語</option>
            {locales.map((locale) => (
              <option key={locale.code} value={locale.code}>
                {locale.name}
              </option>
            ))}
          </select>

          <select
            value={filterNamespace}
            onChange={(e) => setFilterNamespace(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">すべてのネームスペース</option>
            {namespaces.map((ns) => (
              <option key={ns.code} value={ns.code}>
                {ns.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">言語</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">ネームスペース</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">キー</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">値</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    読み込み中...
                  </td>
                </tr>
              ) : filteredTranslations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    データがありません
                  </td>
                </tr>
              ) : (
                filteredTranslations.map((translation) => (
                  <tr key={translation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                        {getLocaleName(translation.locale)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">
                        {getNamespaceName(translation.namespace)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-sm font-mono text-gray-600 bg-gray-100 px-1 py-0.5 rounded">
                        {translation.key}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {translation.value}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleEdit(translation)}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="編集"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(translation.id)}
                        className="text-red-600 hover:text-red-900 p-1 ml-2"
                        title="削除"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingTranslation ? '翻訳編集' : '翻訳追加'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">言語</label>
                <select
                  value={formData.locale}
                  onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
                  disabled={!!editingTranslation}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  {locales.map((locale) => (
                    <option key={locale.code} value={locale.code}>
                      {locale.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ネームスペース</label>
                <select
                  value={formData.namespace}
                  onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                  disabled={!!editingTranslation}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  {namespaces.map((ns) => (
                    <option key={ns.code} value={ns.code}>
                      {ns.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">キー</label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  disabled={!!editingTranslation}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 font-mono"
                  placeholder="welcome_message"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">値</label>
                <textarea
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="翻訳テキスト"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={editingTranslation ? handleUpdate : handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingTranslation ? '更新' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </Layout>
  );
}
