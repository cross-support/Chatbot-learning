import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { WS_EVENTS } from '@crossbot/shared';

interface Message {
  id: string;
  senderType: string;
  contentType: string;
  content: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

interface User {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  metadata?: {
    browser?: string;
    os?: string;
    deviceType?: string;
    ipAddress?: string;
    lastUrl?: string;
  };
}

interface Conversation {
  id: string;
  status: string;
  user: User;
  messages: Message[];
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, admin } = useAuthStore();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 会話データを取得
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const response = await fetch(`/api/conversations/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setConversation(data);
        setMessages(data.messages || []);
      } catch (error) {
        console.error('Failed to fetch conversation:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [id, token]);

  // WebSocket接続
  useEffect(() => {
    const socket = io('/chat', {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_admin_room', { adminId: admin?.id });
      socket.emit(WS_EVENTS.JOIN_ROOM, { conversationId: id });
    });

    socket.on(WS_EVENTS.NEW_MESSAGE, (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on(WS_EVENTS.TYPING_INDICATOR, (_data: { isTyping: boolean; senderType: string }) => {
      // タイピングインジケーター処理（将来の実装用）
    });

    return () => {
      socket.disconnect();
    };
  }, [id, admin?.id]);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    try {
      await fetch(`/api/conversations/${id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: inputValue }),
      });

      setInputValue('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleAssign = async () => {
    try {
      await fetch(`/api/conversations/${id}/assign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      setConversation((prev) =>
        prev ? { ...prev, status: 'HUMAN' } : null
      );
    } catch (error) {
      console.error('Failed to assign:', error);
    }
  };

  const handleClose = async () => {
    try {
      await fetch(`/api/conversations/${id}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to close:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">会話が見つかりません</div>
      </div>
    );
  }

  const user = conversation.user;
  const metadata = user.metadata || {};

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-500 hover:text-gray-700"
            >
              ← 戻る
            </button>
            <span className="font-medium">{user.name || '名前未設定'}</span>
            <span
              className={`px-2 py-1 rounded-full text-xs ${
                conversation.status === 'WAITING'
                  ? 'bg-red-100 text-red-700'
                  : conversation.status === 'HUMAN'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {conversation.status === 'WAITING'
                ? '未対応'
                : conversation.status === 'HUMAN'
                ? '対応中'
                : '完了'}
            </span>
          </div>
          <div className="flex gap-2">
            {conversation.status === 'WAITING' && (
              <button
                onClick={handleAssign}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm"
              >
                対応を開始
              </button>
            )}
            {conversation.status === 'HUMAN' && (
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                対応を終了
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout - 3 Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Messages */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.senderType === 'USER' ? 'justify-start' : 'justify-end'
                }`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-lg ${
                    message.senderType === 'USER'
                      ? 'bg-gray-100 text-gray-800'
                      : message.senderType === 'ADMIN'
                      ? 'bg-primary text-white'
                      : message.senderType === 'BOT'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  <div className="text-xs opacity-70 mb-1">
                    {message.senderType === 'USER'
                      ? 'ユーザー'
                      : message.senderType === 'ADMIN'
                      ? 'オペレーター'
                      : message.senderType === 'BOT'
                      ? 'ボット'
                      : 'システム'}
                  </div>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="メッセージを入力..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                disabled={conversation.status !== 'HUMAN'}
              />
              <button
                type="submit"
                disabled={conversation.status !== 'HUMAN' || !inputValue.trim()}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                送信
              </button>
            </div>
          </form>
        </div>

        {/* User Info Panel */}
        <div className="w-80 bg-white border-l overflow-y-auto">
          <div className="p-4">
            <h3 className="font-medium text-gray-800 mb-4">ユーザ情報</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">名前</label>
                <div className="text-sm">{user.name || '未設定'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500">メール</label>
                <div className="text-sm">{user.email || '未設定'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500">電話番号</label>
                <div className="text-sm">{user.phone || '未設定'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500">会社</label>
                <div className="text-sm">{user.company || '未設定'}</div>
              </div>
            </div>

            <hr className="my-4" />

            <h3 className="font-medium text-gray-800 mb-4">環境情報</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">ブラウザ</label>
                <div className="text-sm">{metadata.browser || '不明'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500">OS</label>
                <div className="text-sm">{metadata.os || '不明'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500">デバイス</label>
                <div className="text-sm">{metadata.deviceType || '不明'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500">IPアドレス</label>
                <div className="text-sm">{metadata.ipAddress || '不明'}</div>
              </div>
            </div>

            <hr className="my-4" />

            <h3 className="font-medium text-gray-800 mb-4">閲覧中のページ</h3>
            <div className="text-sm text-primary break-all">
              {metadata.lastUrl || '不明'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
