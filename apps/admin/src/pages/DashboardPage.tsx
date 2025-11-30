import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface Conversation {
  id: string;
  status: string;
  user: {
    id: string;
    name?: string;
    email?: string;
  };
  messages: {
    content: string;
    createdAt: string;
  }[];
  updatedAt: string;
}

type TabType = 'waiting' | 'active' | 'closed' | 'all';

export default function DashboardPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('waiting');
  const [loading, setLoading] = useState(true);
  const { admin, token, logout } = useAuthStore();
  const navigate = useNavigate();

  const fetchConversations = async () => {
    try {
      const statusMap: Record<TabType, string | undefined> = {
        waiting: 'WAITING',
        active: 'HUMAN',
        closed: 'CLOSED',
        all: undefined,
      };

      const status = statusMap[activeTab];
      const url = status
        ? `/api/conversations?status=${status}`
        : '/api/conversations';

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    logout();
    navigate('/login');
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      WAITING: 'bg-red-100 text-red-700',
      HUMAN: 'bg-green-100 text-green-700',
      BOT: 'bg-blue-100 text-blue-700',
      CLOSED: 'bg-gray-100 text-gray-700',
    };
    const labels: Record<string, string> = {
      WAITING: '未対応',
      HUMAN: '対応中',
      BOT: '自動応答',
      CLOSED: '完了',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${styles[status] || styles.CLOSED}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return '今';
    if (minutes < 60) return `${minutes}分前`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}時間前`;
    return date.toLocaleDateString('ja-JP');
  };

  const waitingCount = conversations.filter((c) => c.status === 'WAITING').length;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">CrossBot 管理画面</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{admin?.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('waiting')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'waiting'
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            未対応
            {waitingCount > 0 && (
              <span className="ml-2 bg-white text-red-500 px-2 py-0.5 rounded-full text-xs">
                {waitingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            対応中
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'closed'
                ? 'bg-gray-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            完了
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            すべて
          </button>
        </div>

        {/* Conversation List */}
        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-gray-500">読み込み中...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              会話がありません
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => navigate(`/chat/${conversation.id}`)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-800 truncate">
                          {conversation.user?.name || conversation.user?.email || '名前未設定'}
                        </span>
                        {getStatusBadge(conversation.status)}
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {conversation.messages[0]?.content || 'メッセージなし'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                      {formatTime(conversation.updatedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
