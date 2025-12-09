import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface OffHoursInquiry {
  id: string;
  name: string;
  email: string;
  company: string | null;
  content: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
  assignedAdminId: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

interface InquiryListResponse {
  items: OffHoursInquiry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface RelatedChat {
  id: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
  messages: Array<{
    id: string;
    senderType: string;
    content: string;
    createdAt: string;
  }>;
  _count: {
    messages: number;
  };
}

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: '未対応', color: 'text-red-600', bg: 'bg-red-100' },
  IN_PROGRESS: { label: '対応中', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  RESOLVED: { label: '対応完了', color: 'text-green-600', bg: 'bg-green-100' },
};

export default function OffHoursInquiriesPage() {
  const { token } = useAuthStore();
  const [inquiries, setInquiries] = useState<OffHoursInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedInquiry, setSelectedInquiry] = useState<OffHoursInquiry | null>(null);
  const [note, setNote] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);

  // メール返信モーダル
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // 関連チャット履歴
  const [relatedChats, setRelatedChats] = useState<RelatedChat[]>([]);
  const [loadingRelatedChats, setLoadingRelatedChats] = useState(false);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', String(page));
      params.append('limit', '20');

      const response = await fetch(`/api/off-hours-inquiries?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return;
      }
      const data: InquiryListResponse = await response.json();
      setInquiries(data.items || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch inquiries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingCount = async () => {
    try {
      const response = await fetch('/api/off-hours-inquiries/pending-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: { count: number } = await response.json();
      setPendingCount(data.count);
    } catch (error) {
      console.error('Failed to fetch pending count:', error);
    }
  };

  useEffect(() => {
    fetchInquiries();
    fetchPendingCount();
  }, [statusFilter, page]);

  // 関連チャット履歴を取得
  const fetchRelatedChats = async (inquiryId: string) => {
    setLoadingRelatedChats(true);
    try {
      const response = await fetch(`/api/off-hours-inquiries/${inquiryId}/related-chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setRelatedChats(data.items || []);
    } catch (error) {
      console.error('Failed to fetch related chats:', error);
      setRelatedChats([]);
    } finally {
      setLoadingRelatedChats(false);
    }
  };

  // 問い合わせ選択時に関連チャットも取得
  const handleSelectInquiry = (inquiry: OffHoursInquiry) => {
    setSelectedInquiry(inquiry);
    setNote(inquiry.note || '');
    fetchRelatedChats(inquiry.id);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/off-hours-inquiries/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchInquiries();
      fetchPendingCount();
      if (selectedInquiry?.id === id) {
        setSelectedInquiry({ ...selectedInquiry, status: newStatus as OffHoursInquiry['status'] });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleNoteSave = async () => {
    if (!selectedInquiry) return;
    try {
      await fetch(`/api/off-hours-inquiries/${selectedInquiry.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note }),
      });
      fetchInquiries();
      setSelectedInquiry({ ...selectedInquiry, note });
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // メール返信モーダルを開く
  const openReplyModal = () => {
    if (!selectedInquiry) return;
    setReplySubject(`Re: お問い合わせへのご回答`);
    setReplyBody('');
    setShowReplyModal(true);
  };

  // メール返信を送信
  const handleSendReply = async () => {
    if (!selectedInquiry || !replySubject.trim() || !replyBody.trim()) return;

    setSendingReply(true);
    try {
      const response = await fetch(`/api/off-hours-inquiries/${selectedInquiry.id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: replySubject,
          body: replyBody,
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert('返信メールを送信しました');
        setShowReplyModal(false);
        fetchInquiries();
        fetchPendingCount();
        // 選択中の問い合わせ情報を更新
        const updatedResponse = await fetch(`/api/off-hours-inquiries/${selectedInquiry.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const updatedInquiry = await updatedResponse.json();
        setSelectedInquiry(updatedInquiry);
        setNote(updatedInquiry.note || '');
      } else {
        alert(result.message || 'メール送信に失敗しました');
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert('メール送信に失敗しました');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <Layout>
    <div className="flex h-full">
      {/* 左側: 一覧 */}
      <div className="w-1/2 border-r border-gray-200 flex flex-col">
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-800">
              時間外問い合わせ
              {pendingCount > 0 && (
                <span className="ml-2 px-2 py-1 text-sm bg-red-500 text-white rounded-full">
                  {pendingCount}件 要対応
                </span>
              )}
            </h1>
          </div>
          {/* フィルター */}
          <div className="flex gap-2">
            <button
              onClick={() => { setStatusFilter(''); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === ''
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              すべて ({total})
            </button>
            <button
              onClick={() => { setStatusFilter('PENDING'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'PENDING'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-100 text-red-600 hover:bg-red-200'
              }`}
            >
              未対応
            </button>
            <button
              onClick={() => { setStatusFilter('IN_PROGRESS'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'IN_PROGRESS'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
              }`}
            >
              対応中
            </button>
            <button
              onClick={() => { setStatusFilter('RESOLVED'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'RESOLVED'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-100 text-green-600 hover:bg-green-200'
              }`}
            >
              完了
            </button>
          </div>
        </div>

        {/* リスト */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
            </div>
          ) : inquiries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              問い合わせはありません
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {inquiries.map((inquiry) => (
                <div
                  key={inquiry.id}
                  onClick={() => handleSelectInquiry(inquiry)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedInquiry?.id === inquiry.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{inquiry.name}</span>
                        {inquiry.company && (
                          <span className="text-sm text-gray-500">({inquiry.company})</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{inquiry.email}</div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${statusLabels[inquiry.status].bg} ${statusLabels[inquiry.status].color}`}>
                      {statusLabels[inquiry.status].label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{inquiry.content}</p>
                  <div className="text-xs text-gray-400 mt-2">{formatDate(inquiry.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右側: 詳細 */}
      <div className="w-1/2 flex flex-col bg-gray-50">
        {selectedInquiry ? (
          <>
            {/* 詳細ヘッダー */}
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">問い合わせ詳細</h2>
                <select
                  value={selectedInquiry.status}
                  onChange={(e) => handleStatusChange(selectedInquiry.id, e.target.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${statusLabels[selectedInquiry.status].bg} ${statusLabels[selectedInquiry.status].color}`}
                >
                  <option value="PENDING">未対応</option>
                  <option value="IN_PROGRESS">対応中</option>
                  <option value="RESOLVED">対応完了</option>
                </select>
              </div>
            </div>

            {/* 詳細内容 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">送信者情報</h3>
                  <button
                    onClick={openReplyModal}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    返信する
                  </button>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-500">氏名: </span>
                    <span className="font-medium">{selectedInquiry.name}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">メール: </span>
                    <a href={`mailto:${selectedInquiry.email}`} className="text-blue-600 hover:underline">
                      {selectedInquiry.email}
                    </a>
                  </div>
                  {selectedInquiry.company && (
                    <div>
                      <span className="text-sm text-gray-500">派遣会社: </span>
                      <span>{selectedInquiry.company}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-gray-500">送信日時: </span>
                    <span>{formatDate(selectedInquiry.createdAt)}</span>
                  </div>
                  {selectedInquiry.resolvedAt && (
                    <div>
                      <span className="text-sm text-gray-500">対応完了日時: </span>
                      <span>{formatDate(selectedInquiry.resolvedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">問い合わせ内容</h3>
                <p className="whitespace-pre-wrap text-gray-800">{selectedInquiry.content}</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">管理者メモ</h3>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="対応内容やメモを入力..."
                />
                <button
                  onClick={handleNoteSave}
                  className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  メモを保存
                </button>
              </div>

              {/* 関連チャット履歴 */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  関連チャット履歴
                  <span className="text-xs text-gray-400 ml-2">（同じメールアドレスのユーザー）</span>
                </h3>
                {loadingRelatedChats ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500"></div>
                  </div>
                ) : relatedChats.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">関連するチャット履歴はありません</p>
                ) : (
                  <div className="space-y-3">
                    {relatedChats.map((chat) => (
                      <a
                        key={chat.id}
                        href={`/rtchat?chat=${chat.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800">
                            {chat.user.name || chat.user.email || 'ゲスト'}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            chat.status === 'CLOSED' ? 'bg-gray-100 text-gray-600' :
                            chat.status === 'HUMAN' ? 'bg-green-100 text-green-600' :
                            'bg-yellow-100 text-yellow-600'
                          }`}>
                            {chat.status === 'CLOSED' ? '終了' :
                             chat.status === 'HUMAN' ? '有人対応中' :
                             chat.status === 'WAITING' ? '待機中' : 'ボット対応'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">
                          {formatDate(chat.createdAt)}
                          {chat.closedAt && ` ～ ${formatDate(chat.closedAt)}`}
                        </p>
                        <p className="text-xs text-gray-600">
                          メッセージ数: {chat._count.messages}件
                        </p>
                        {chat.messages.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            最新: {chat.messages[0].content}
                          </p>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            左側のリストから問い合わせを選択してください
          </div>
        )}
      </div>
    </div>

    {/* メール返信モーダル */}
    {showReplyModal && selectedInquiry && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">メールで返信</h2>
              <button
                onClick={() => setShowReplyModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-1">宛先</div>
              <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-800">
                {selectedInquiry.name} &lt;{selectedInquiry.email}&gt;
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">件名</label>
              <input
                type="text"
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">本文</label>
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 h-48 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="返信内容を入力してください..."
              />
            </div>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-500 mb-2">元のお問い合わせ内容</div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedInquiry.content}</p>
            </div>
          </div>
          <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={() => setShowReplyModal(false)}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={sendingReply}
            >
              キャンセル
            </button>
            <button
              onClick={handleSendReply}
              disabled={sendingReply || !replySubject.trim() || !replyBody.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {sendingReply ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  送信中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  送信する
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </Layout>
  );
}
