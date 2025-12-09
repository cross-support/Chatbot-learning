import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

interface RichMessage {
  id: string;
  type: string;
  name: string;
  content: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  carousel: 'カルーセル',
  quick_reply: 'クイックリプライ',
  button: 'ボタンテンプレート',
  image_map: 'イメージマップ',
};

export default function RichMessagePage() {
  const [messages, setMessages] = useState<RichMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<RichMessage[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<RichMessage | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<RichMessage | null>(null);

  const [formData, setFormData] = useState({
    type: 'carousel',
    name: '',
    content: {} as Record<string, unknown>,
  });

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    if (filterType === 'all') {
      setFilteredMessages(messages);
    } else {
      setFilteredMessages(messages.filter((m) => m.type === filterType));
    }
  }, [messages, filterType]);

  const loadMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/rich-messages', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('データの取得に失敗しました');
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name) {
      setError('名前を入力してください');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/rich-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: formData.type,
          name: formData.name,
          content: getDefaultContent(formData.type),
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error('作成に失敗しました');
      setSuccess('リッチメッセージを作成しました');
      setDialogOpen(false);
      resetForm();
      loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
    }
  };

  const handleEdit = (message: RichMessage) => {
    setEditingMessage(message);
    setFormData({
      type: message.type,
      name: message.name,
      content: message.content,
    });
    setDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingMessage || !formData.name) {
      setError('名前を入力してください');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/rich-messages/${editingMessage.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          content: formData.content,
        }),
      });
      if (!res.ok) throw new Error('更新に失敗しました');
      setSuccess('リッチメッセージを更新しました');
      setDialogOpen(false);
      setEditingMessage(null);
      resetForm();
      loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('このリッチメッセージを削除しますか?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/rich-messages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('削除に失敗しました');
      setSuccess('リッチメッセージを削除しました');
      loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  const handlePreview = (message: RichMessage) => {
    setPreviewMessage(message);
    setPreviewOpen(true);
  };

  const resetForm = () => {
    setFormData({
      type: 'carousel',
      name: '',
      content: {},
    });
  };

  const getDefaultContent = (type: string): Record<string, unknown> => {
    switch (type) {
      case 'carousel':
        return {
          items: [
            {
              title: 'サンプルアイテム',
              description: '説明文',
              imageUrl: '',
              buttons: [{ label: 'ボタン', action: 'message', value: 'クリックしました' }],
            },
          ],
        };
      case 'quick_reply':
        return {
          options: [
            { label: 'オプション1', action: 'message', value: 'オプション1を選択' },
            { label: 'オプション2', action: 'message', value: 'オプション2を選択' },
          ],
        };
      case 'button':
        return {
          text: 'メッセージテキスト',
          buttons: [{ label: 'ボタン', action: 'message', value: 'ボタンをクリック' }],
        };
      case 'image_map':
        return {
          imageUrl: '',
          areas: [
            { x: 0, y: 0, width: 50, height: 50, action: 'message', value: 'エリア1' },
          ],
        };
      default:
        return {};
    }
  };

  return (
    <Layout>
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">リッチメッセージ管理</h1>
        <button
          onClick={() => {
            resetForm();
            setEditingMessage(null);
            setDialogOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新規作成
        </button>
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
        <div className="p-4 border-b">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">すべて</option>
            <option value="carousel">カルーセル</option>
            <option value="quick_reply">クイックリプライ</option>
            <option value="button">ボタンテンプレート</option>
            <option value="image_map">イメージマップ</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名前</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイプ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">作成日時</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    読み込み中...
                  </td>
                </tr>
              ) : filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    データがありません
                  </td>
                </tr>
              ) : (
                filteredMessages.map((message) => (
                  <tr key={message.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{message.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                        {typeLabels[message.type] || message.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          message.isActive
                            ? 'text-green-700 bg-green-100'
                            : 'text-gray-700 bg-gray-100'
                        }`}
                      >
                        {message.isActive ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(message.createdAt).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handlePreview(message)}
                        className="text-cyan-600 hover:text-cyan-900 p-1"
                        title="プレビュー"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEdit(message)}
                        className="text-blue-600 hover:text-blue-900 p-1 ml-2"
                        title="編集"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(message.id)}
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
                {editingMessage ? 'リッチメッセージ編集' : 'リッチメッセージ作成'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="リッチメッセージ名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイプ</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  disabled={!!editingMessage}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  <option value="carousel">カルーセル</option>
                  <option value="quick_reply">クイックリプライ</option>
                  <option value="button">ボタンテンプレート</option>
                  <option value="image_map">イメージマップ</option>
                </select>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                作成後、詳細な設定は編集画面で行えます。
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
                onClick={editingMessage ? handleUpdate : handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingMessage ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      {previewOpen && previewMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                プレビュー: {previewMessage.name}
              </h2>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-xs max-h-96">
                {JSON.stringify(previewMessage.content, null, 2)}
              </pre>
            </div>
            <div className="px-6 py-4 border-t flex justify-end">
              <button
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
