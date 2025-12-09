import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { WS_EVENTS } from '@crossbot/shared';
import Layout from '../components/Layout';
import { useNotification } from '../hooks/useNotification';

interface Template {
  id: string;
  code: string;
  name: string;
  content: string;
  category: string | null;
}

interface Message {
  id: string;
  senderType: string;
  contentType: string;
  content: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  isRead?: boolean;
}

interface UserMetadata {
  browser?: string;
  os?: string;
  deviceType?: string;
  ipAddress?: string;
  lastUrl?: string;
  lastTitle?: string;
  pageTitle?: string;
}

interface User {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  memo?: string;
  labels?: string[];
  metadata?: UserMetadata;
}

interface Conversation {
  id: string;
  status: string;
  user: User;
  messages: Message[];
  updatedAt: string;
  createdAt: string;
  isStarred?: boolean;
}

type FilterType = 'all' | 'unread' | 'starred';

export default function RtChatPage() {
  const { token, admin } = useAuthStore();
  const { notifyNewChat, notifyNewMessage, notifyHandoverRequest, requestPermission, permissionStatus, settings, updateSettings, playTestSound } = useNotification();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [conversationOffset, setConversationOffset] = useState(0);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [userInfoEditing, setUserInfoEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<Partial<User>>({});
  const [newLabel, setNewLabel] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [rightTab, setRightTab] = useState<'user' | 'template'>('user');
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string>('all');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; isImage: boolean } | null>(null);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  // モバイル用: どのパネルを表示するか（list: 会話一覧, chat: チャット, info: ユーザー情報）
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'info'>('list');
  // 会話品質スコア
  const [qualityScore, setQualityScore] = useState<{
    overallScore: number;
    responseTimeScore: number;
    resolutionScore: number;
    sentimentScore: number;
    engagementScore: number;
  } | null>(null);
  const [loadingQualityScore, setLoadingQualityScore] = useState(false);
  // ナレッジ検索
  const [knowledgeSuggestions, setKnowledgeSuggestions] = useState<{
    type: 'faq' | 'template' | 'scenario';
    id: string;
    title: string;
    content: string;
    score: number;
    category?: string;
  }[]>([]);
  const [showKnowledgeSuggestions, setShowKnowledgeSuggestions] = useState(false);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const knowledgeSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedConversationRef = useRef<Conversation | null>(null);

  // selectedConversationをrefに同期
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const CONVERSATIONS_PER_PAGE = 20;
  const MESSAGES_PER_PAGE = 50;

  // 会話一覧を取得
  const fetchConversations = async (append = false) => {
    try {
      const offset = append ? conversationOffset : 0;
      const response = await fetch(`/api/conversations?limit=${CONVERSATIONS_PER_PAGE}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      console.log('[fetchConversations] API response:', data);
      const allConversations = data.conversations || [];
      console.log('[fetchConversations] All conversations:', allConversations);

      if (append) {
        setConversations((prev) => [...prev, ...allConversations]);
      } else {
        setConversations(allConversations);
      }

      // まだ取得できる会話があるか判定
      setHasMoreConversations(allConversations.length >= CONVERSATIONS_PER_PAGE);
      if (append) {
        setConversationOffset(offset + allConversations.length);
      } else {
        setConversationOffset(allConversations.length);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // 次の会話を読み込む
  const loadMoreConversations = async () => {
    if (loadingMore || !hasMoreConversations) return;
    setLoadingMore(true);
    await fetchConversations(true);
  };

  // テンプレート取得
  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchTemplates();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [token]);

  // 会話を選択したときにメッセージを取得
  const selectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    setIsUserTyping(false); // 会話切り替え時にリセット
    setHasOlderMessages(true); // リセット
    setMobileView('chat'); // モバイルでチャット画面に切り替え
    setEditedUser({
      name: conv.user.name || '',
      email: conv.user.email || '',
      phone: conv.user.phone || '',
      company: conv.user.company || '',
      memo: conv.user.memo || '',
      labels: conv.user.labels || [],
    });
    setUserInfoEditing(false);

    // 会話ルームに参加
    if (socketRef.current) {
      socketRef.current.emit('join_admin_room', {
        adminId: admin?.id,
        conversationId: conv.id,
      });
    }

    try {
      const response = await fetch(`/api/conversations/${conv.id}/messages?limit=${MESSAGES_PER_PAGE}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const messagesData = await response.json();
      setMessages(messagesData || []);
      setHasOlderMessages((messagesData || []).length >= MESSAGES_PER_PAGE);

      // 会話詳細も取得
      const convResponse = await fetch(`/api/conversations/${conv.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const convData = await convResponse.json();
      setSelectedConversation(convData);

      // ユーザーからのメッセージを既読としてマーク
      if (socketRef.current) {
        socketRef.current.emit(WS_EVENTS.MARK_READ, {
          conversationId: conv.id,
          senderType: 'ADMIN',
        });
      }

      // 品質スコアを取得（非同期で実行）
      fetchQualityScore(conv.id);
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
    }
  };

  // 品質スコアを取得
  const fetchQualityScore = async (conversationId: string) => {
    setLoadingQualityScore(true);
    setQualityScore(null);
    try {
      const response = await fetch(`/api/insights/quality/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setQualityScore(data);
      }
    } catch (error) {
      console.error('Failed to fetch quality score:', error);
    } finally {
      setLoadingQualityScore(false);
    }
  };

  // 過去のメッセージを読み込む
  const loadOlderMessages = async () => {
    if (loadingOlderMessages || !hasOlderMessages || !selectedConversation || messages.length === 0) return;

    setLoadingOlderMessages(true);
    const oldestMessage = messages[0];

    try {
      const response = await fetch(
        `/api/conversations/${selectedConversation.id}/messages?limit=${MESSAGES_PER_PAGE}&before=${oldestMessage.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const olderMessages = await response.json();

      if (olderMessages.length > 0) {
        setMessages((prev) => [...olderMessages, ...prev]);
      }
      setHasOlderMessages(olderMessages.length >= MESSAGES_PER_PAGE);
    } catch (error) {
      console.error('Failed to load older messages:', error);
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  // WebSocket接続
  useEffect(() => {
    const socket = io('/chat', {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // 管理者ルームに参加
      socket.emit('join_admin_room', {
        adminId: admin?.id,
      });
    });

    socket.on(WS_EVENTS.NEW_MESSAGE, (message: Message & { conversationId: string; userName?: string }) => {
      // 選択中の会話のメッセージなら追加
      const currentConv = selectedConversationRef.current;
      if (currentConv && message.conversationId === currentConv.id) {
        setMessages((prev) => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }

      // ユーザーからのメッセージは全て通知
      if (message.senderType === 'USER') {
        notifyNewMessage(message.userName, message.content);
      }

      // 会話一覧も更新
      fetchConversations();
    });

    // 新規会話の通知
    socket.on(WS_EVENTS.CONVERSATION_UPDATED, (data?: { type?: string; userName?: string }) => {
      console.log('[RtChatPage] CONVERSATION_UPDATED received:', data);
      if (data?.type === 'new_conversation') {
        console.log('[RtChatPage] Calling notifyNewChat for:', data.userName);
        notifyNewChat(data.userName);
      }
      fetchConversations();
    });

    // ハンドオーバーリクエストの通知
    socket.on(WS_EVENTS.NEW_REQUEST, (data?: { conversation?: { user?: { name?: string } } }) => {
      const userName = data?.conversation?.user?.name || 'ユーザー';
      notifyHandoverRequest(userName);
      fetchConversations();
    });

    // ユーザーの入力中表示
    socket.on(WS_EVENTS.TYPING_INDICATOR, (data: { conversationId: string; senderType: string; isTyping: boolean }) => {
      const currentConv = selectedConversationRef.current;
      if (currentConv && data.conversationId === currentConv.id && data.senderType === 'USER') {
        setIsUserTyping(data.isTyping);
        // 入力中が消えない場合のフォールバック
        if (data.isTyping) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setIsUserTyping(false);
          }, 5000);
        }
      }
    });

    // 既読通知
    socket.on(WS_EVENTS.MESSAGES_READ, (data: { conversationId: string; messageIds: string[] }) => {
      const currentConv = selectedConversationRef.current;
      if (currentConv && data.conversationId === currentConv.id) {
        setMessages((prev) =>
          prev.map((m) =>
            data.messageIds.includes(m.id) ? { ...m, isRead: true } : m
          )
        );
      }
    });

    // 全メッセージ既読
    socket.on(WS_EVENTS.ALL_MESSAGES_READ, (data: { conversationId: string; readBy?: string }) => {
      const currentConv = selectedConversationRef.current;
      if (currentConv && data.conversationId === currentConv.id) {
        // readByがUSERの場合、管理者が送ったメッセージを既読にする
        // readByがADMINの場合、ユーザーが送ったメッセージを既読にする（管理画面では表示しない）
        if (data.readBy === 'USER') {
          setMessages((prev) => prev.map((m) =>
            m.senderType === 'ADMIN' || m.senderType === 'BOT' ? { ...m, isRead: true } : m
          ));
        } else if (data.readBy === 'ADMIN') {
          setMessages((prev) => prev.map((m) =>
            m.senderType === 'USER' ? { ...m, isRead: true } : m
          ));
        } else {
          // readByがない場合は全て既読
          setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
        }
      }
    });

    return () => {
      socket.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.id]);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // ナレッジ検索を実行
  const searchKnowledge = async (query: string) => {
    if (query.length < 2) {
      setKnowledgeSuggestions([]);
      setShowKnowledgeSuggestions(false);
      return;
    }

    setLoadingKnowledge(true);
    try {
      const response = await fetch(`/api/faq/knowledge/search?q=${encodeURIComponent(query)}&limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setKnowledgeSuggestions(data);
        setShowKnowledgeSuggestions(data.length > 0);
      }
    } catch (error) {
      console.error('Knowledge search failed:', error);
    } finally {
      setLoadingKnowledge(false);
    }
  };

  // ナレッジサジェストを選択
  const selectKnowledgeSuggestion = (suggestion: typeof knowledgeSuggestions[0]) => {
    setInputValue(suggestion.content);
    setShowKnowledgeSuggestions(false);
    setKnowledgeSuggestions([]);
  };

  // 管理者の入力中を送信
  const adminTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInputChange = (value: string) => {
    setInputValue(value);

    // `/` で始まる場合はナレッジ検索をトリガー
    if (value.startsWith('/') && value.length > 1) {
      const searchQuery = value.slice(1);
      // デバウンス
      if (knowledgeSearchTimeoutRef.current) {
        clearTimeout(knowledgeSearchTimeoutRef.current);
      }
      knowledgeSearchTimeoutRef.current = setTimeout(() => {
        searchKnowledge(searchQuery);
      }, 300);
    } else {
      setShowKnowledgeSuggestions(false);
      setKnowledgeSuggestions([]);
    }

    if (!socketRef.current || !selectedConversation) return;

    // 入力中を送信
    socketRef.current.emit(WS_EVENTS.TYPING, {
      conversationId: selectedConversation.id,
      senderType: 'ADMIN',
      isTyping: true,
    });

    // 一定時間後に入力中を解除
    if (adminTypingTimeoutRef.current) {
      clearTimeout(adminTypingTimeoutRef.current);
    }
    adminTypingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit(WS_EVENTS.TYPING, {
        conversationId: selectedConversation.id,
        senderType: 'ADMIN',
        isTyping: false,
      });
    }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!selectedConversation) return;

    // テキストも画像もない場合は送信しない
    if (!inputValue.trim() && !pendingImage) return;

    const messageContent = inputValue;
    setInputValue('');
    setUploadingImage(true);

    try {
      // ファイルがある場合は先にアップロード
      if (pendingImage) {
        const fileUrl = await uploadImage();
        if (fileUrl) {
          // 画像かファイルかで contentType を分ける
          const contentType = pendingImage.isImage ? 'IMAGE' : 'FILE';
          const response = await fetch(`/api/conversations/${selectedConversation.id}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              content: fileUrl,
              contentType,
            }),
          });

          const newMessage = await response.json();
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
        // プレビューをクリア
        if (pendingImage.previewUrl) {
          URL.revokeObjectURL(pendingImage.previewUrl);
        }
        setPendingImage(null);
      }

      // テキストがある場合は送信
      if (messageContent.trim()) {
        const response = await fetch(`/api/conversations/${selectedConversation.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: messageContent }),
        });

        const newMessage = await response.json();
        setMessages((prev) => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      if (messageContent.trim()) {
        setInputValue(messageContent);
      }
      alert('送信に失敗しました');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedConversation) return;
    try {
      await fetch(`/api/conversations/${selectedConversation.id}/assign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedConversation((prev) => prev ? { ...prev, status: 'HUMAN' } : null);
      fetchConversations();
    } catch (error) {
      console.error('Failed to assign:', error);
    }
  };

  const handleClose = async () => {
    if (!selectedConversation) return;
    try {
      await fetch(`/api/conversations/${selectedConversation.id}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedConversation(null);
      setMessages([]);
      fetchConversations();
    } catch (error) {
      console.error('Failed to close:', error);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedConversation) return;
    try {
      await fetch(`/api/users/${selectedConversation.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editedUser),
      });
      setSelectedConversation((prev) =>
        prev ? { ...prev, user: { ...prev.user, ...editedUser } } : null
      );
      setUserInfoEditing(false);
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleAddLabel = () => {
    if (!newLabel.trim()) return;
    setEditedUser((prev) => ({
      ...prev,
      labels: [...(prev.labels || []), newLabel.trim()],
    }));
    setNewLabel('');
  };

  const handleSelectTemplate = (template: Template) => {
    setInputValue(template.content);
    setRightTab('user');
  };

  const handleToggleStar = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation(); // 会話選択を防ぐ
    try {
      const response = await fetch(`/api/conversations/${convId}/star`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const updatedConv = await response.json();
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, isStarred: updatedConv.isStarred } : c))
      );
      if (selectedConversation?.id === convId) {
        setSelectedConversation((prev) =>
          prev ? { ...prev, isStarred: updatedConv.isStarred } : null
        );
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  // 許可されるファイルタイプ
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/heic'];
  const DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

  // ファイル選択（プレビュー表示）
  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;

    const isImage = IMAGE_TYPES.includes(file.type);
    const isDocument = DOCUMENT_TYPES.includes(file.type);

    // ファイル形式チェック
    if (!isImage && !isDocument) {
      alert('対応していないファイル形式です\n（画像: JPEG, PNG, GIF, HEIC / 書類: PDF, Word, Excel）');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // ファイルサイズチェック (画像5MB、ドキュメント10MB)
    const maxSize = isImage ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`ファイルサイズは${maxSize / (1024 * 1024)}MB以下にしてください`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // プレビュー用URLを生成してstateに保存
    const previewUrl = isImage ? URL.createObjectURL(file) : '';
    setPendingImage({ file, previewUrl, isImage });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ファイルプレビューをキャンセル
  const handleCancelImage = () => {
    if (pendingImage) {
      if (pendingImage.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
      setPendingImage(null);
    }
  };

  // ファイル拡張子からアイコンを取得
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (ext === 'doc' || ext === 'docx') return '📝';
    if (ext === 'xls' || ext === 'xlsx') return '📊';
    return '📎';
  };

  // 画像アップロードを実行
  const uploadImage = async (): Promise<string | null> => {
    if (!pendingImage || !selectedConversation) return null;

    const formData = new FormData();
    formData.append('file', pendingImage.file);

    const uploadResponse = await fetch(
      `/api/uploads/local/${selectedConversation.id}/${encodeURIComponent(pendingImage.file.name)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    const uploadResult = await uploadResponse.json();

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'アップロードに失敗しました');
    }

    return uploadResult.imageUrl;
  };

  const templateCategories = ['all', ...new Set(templates.map((t) => t.category || '未分類'))];

  const filteredTemplates =
    selectedTemplateCategory === 'all'
      ? templates
      : templates.filter((t) => (t.category || '未分類') === selectedTemplateCategory);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ユーザー表示名を取得（名前がない場合は「ゲスト + 月日 時分」形式）
  const getUserDisplayName = (user: User, createdAt: string) => {
    if (user.name) return user.name;
    if (user.email) return user.email.split('@')[0];
    const date = new Date(createdAt);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `ゲスト ${month}/${day} ${hour}:${min}`;
  };

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch = searchQuery === '' ||
      conv.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterType === 'starred') return matchesSearch && conv.isStarred;
    if (filterType === 'unread') return matchesSearch && conv.status === 'WAITING';
    return matchesSearch;
  });

  const metadata = selectedConversation?.user.metadata || {};

  return (
    <Layout hideHeaderOnMobile={mobileView === 'chat'}>
      <div className="h-full flex overflow-hidden">
        {/* Left Sidebar - User List */}
        <div className={`w-full md:w-80 bg-white border-r border-gray-200 flex flex-col ${mobileView !== 'list' ? 'hidden md:flex' : 'flex'}`}>
          {/* App Title */}
          <div className="p-3 border-b border-gray-200">
            <div className="w-full px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium text-center">
              クロスラーニングサポート事務局
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="名前、メール等で検索..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          {/* Filters */}
          <div className="p-3 border-b border-gray-200 flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            >
              <option value="all">すべてのユーザー</option>
              <option value="unread">未対応ユーザーを優先して表示</option>
              <option value="starred">スター付きユーザー</option>
            </select>
            <button
              onClick={() => setShowNotificationSettings(!showNotificationSettings)}
              className={`p-2 transition-colors ${settings.soundEnabled || settings.browserEnabled ? 'text-primary hover:text-primary-hover' : 'text-gray-400 hover:text-gray-600'}`}
              title="通知設定"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          </div>

          {/* Notification Settings Dropdown */}
          {showNotificationSettings && (
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-3">通知設定</h4>

              {permissionStatus !== 'granted' && (
                <button
                  onClick={requestPermission}
                  className="w-full mb-3 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                  ブラウザ通知を許可
                </button>
              )}

              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">サウンド通知</span>
                  <button
                    onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.soundEnabled ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">ブラウザ通知</span>
                  <button
                    onClick={() => updateSettings({ browserEnabled: !settings.browserEnabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.browserEnabled ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.browserEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
              </div>

              {permissionStatus === 'denied' && (
                <p className="mt-2 text-xs text-red-500">
                  ブラウザ通知がブロックされています。ブラウザの設定から許可してください。
                </p>
              )}

              <button
                onClick={playTestSound}
                className="w-full mt-3 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                🔔 通知音をテスト
              </button>
            </div>
          )}

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">読み込み中...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">会話がありません</div>
            ) : (
              filteredConversations.map((conv) => {
                // ステータスに応じた色とラベル
                const getStatusInfo = (status: string) => {
                  switch (status) {
                    case 'BOT':
                      return {
                        lampColor: 'bg-blue-500',
                        pulseColor: 'bg-blue-400',
                        label: 'BOT対応',
                        badgeClass: 'text-blue-700 bg-blue-100',
                        pulse: false
                      };
                    case 'WAITING':
                      return {
                        lampColor: 'bg-orange-500',
                        pulseColor: 'bg-orange-400',
                        label: '対応待ち',
                        badgeClass: 'text-orange-700 bg-orange-100',
                        pulse: true
                      };
                    case 'HUMAN':
                      return {
                        lampColor: 'bg-green-500',
                        pulseColor: 'bg-green-400',
                        label: '対応中',
                        badgeClass: 'text-green-700 bg-green-100',
                        pulse: false
                      };
                    case 'CLOSED':
                      return {
                        lampColor: 'bg-gray-400',
                        pulseColor: 'bg-gray-300',
                        label: '対応完了',
                        badgeClass: 'text-gray-600 bg-gray-100',
                        pulse: false
                      };
                    default:
                      return {
                        lampColor: 'bg-gray-400',
                        pulseColor: 'bg-gray-300',
                        label: status,
                        badgeClass: 'text-gray-600 bg-gray-100',
                        pulse: false
                      };
                  }
                };
                const statusInfo = getStatusInfo(conv.status);

                return (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedConversation?.id === conv.id ? 'bg-primary-light border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar with Status Indicator */}
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                        </div>
                        {/* Status Lamp */}
                        <div className="absolute -bottom-0.5 -right-0.5">
                          <span className="relative flex h-3.5 w-3.5">
                            {statusInfo.pulse && (
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusInfo.pulseColor} opacity-75`}></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${statusInfo.lampColor} border-2 border-white`}></span>
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-800 truncate">
                            {getUserDisplayName(conv.user, conv.createdAt)}
                          </span>
                          <button
                            onClick={(e) => handleToggleStar(e, conv.id)}
                            className={`${conv.isStarred ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
                          >
                            <svg className={`w-5 h-5 ${conv.isStarred ? 'fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${statusInfo.badgeClass}`}>
                            {statusInfo.label}
                          </span>
                          <span className="text-xs text-gray-400">{formatTimeShort(conv.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Load More */}
          {hasMoreConversations && (
            <div className="p-3 border-t border-gray-200 text-center">
              <button
                onClick={loadMoreConversations}
                disabled={loadingMore}
                className="text-sm text-primary hover:text-primary-hover disabled:opacity-50"
              >
                {loadingMore ? '読み込み中...' : '次の20件を表示'}
              </button>
            </div>
          )}
        </div>

        {/* Center - Chat Area */}
        <div className={`flex-1 flex flex-col bg-gray-50 h-full overflow-hidden relative ${mobileView !== 'chat' ? 'hidden md:flex' : 'flex'}`}>
          {selectedConversation ? (
            <div className="flex flex-col h-full">
              {/* Chat Header */}
              <div className="bg-white border-b border-gray-200 p-3 md:p-4 flex-shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                    {/* Mobile Back Button */}
                    <button
                      onClick={() => setMobileView('list')}
                      className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900"
                      aria-label="会話一覧に戻る"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <img src="/christmas-penguin.png" alt="Bot" className="w-8 h-8 md:w-10 md:h-10" onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-800 text-sm md:text-base truncate">
                        <span className="hidden sm:inline">こんにちわ。</span><span className="text-primary font-medium">Cross Learningサポート</span><span className="hidden sm:inline">です。</span>
                      </p>
                      <p className="text-xs text-gray-400">{formatTime(selectedConversation.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 md:gap-2 flex-shrink-0">
                    {/* エクスポートボタン - PC only */}
                    <div className="relative group hidden md:block">
                      <button
                        className="px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                        title="会話をエクスポート"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
                        <button
                          onClick={() => window.open(`/api/conversations/${selectedConversation.id}/export?format=json`, '_blank')}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                        >
                          JSON形式
                        </button>
                        <button
                          onClick={() => window.open(`/api/conversations/${selectedConversation.id}/export?format=csv`, '_blank')}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
                        >
                          CSV形式
                        </button>
                      </div>
                    </div>
                    {/* Mobile: User Info Button */}
                    <button
                      onClick={() => {
                        setRightTab('user');
                        setMobileView('info');
                      }}
                      className="md:hidden p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                      aria-label="ユーザー情報"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </button>
                    {/* Desktop: Tab buttons */}
                    <button
                      onClick={() => setRightTab('user')}
                      className={`hidden md:block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        rightTab === 'user'
                          ? 'bg-primary text-white hover:bg-primary-hover'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      ユーザ情報
                    </button>
                    <button
                      onClick={() => setRightTab('template')}
                      className={`hidden md:block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        rightTab === 'template'
                          ? 'bg-primary text-white hover:bg-primary-hover'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      応答テンプレート
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {/* 過去のメッセージを読み込むボタン */}
                {hasOlderMessages && messages.length > 0 && (
                  <div className="text-center py-2">
                    <button
                      onClick={loadOlderMessages}
                      disabled={loadingOlderMessages}
                      className="text-sm text-primary hover:text-primary-hover disabled:opacity-50 px-4 py-2 bg-white border border-gray-200 rounded-lg"
                    >
                      {loadingOlderMessages ? '読み込み中...' : '過去のメッセージを表示'}
                    </button>
                  </div>
                )}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderType === 'USER' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-3 py-2 md:px-4 md:py-3 ${
                        message.senderType === 'USER'
                          ? 'bg-white border border-gray-200 text-gray-800'
                          : message.senderType === 'ADMIN'
                          ? 'bg-primary text-white'
                          : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                      }`}
                    >
                      {message.contentType === 'NAVIGATION' && message.payload ? (
                        <div className="border border-pink-200 rounded-lg p-3 bg-white">
                          <div className="flex items-center gap-2 text-primary-hover text-sm">
                            <span>ページ移動 &gt;</span>
                            <span>{String(message.payload.pageTitle || message.content)}</span>
                          </div>
                        </div>
                      ) : message.contentType === 'IMAGE' ? (
                        <div>
                          <img
                            src={message.content}
                            alt="uploaded"
                            className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                            onClick={() => window.open(message.content, '_blank')}
                          />
                        </div>
                      ) : message.contentType === 'FILE' ? (
                        (() => {
                          const fileName = message.content.split('/').pop() || 'ファイル';
                          const ext = fileName.split('.').pop()?.toLowerCase();
                          const isPdf = ext === 'pdf';
                          const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '');

                          // PDFはブラウザで直接表示、Office系はGoogle Docs Viewerを使用
                          const previewUrl = isPdf
                            ? message.content
                            : isOffice
                              ? `https://docs.google.com/gview?url=${encodeURIComponent(message.content)}&embedded=true`
                              : message.content;

                          return (
                            <div className="space-y-2">
                              <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors no-underline"
                              >
                                <span className="text-2xl">{getFileIcon(fileName)}</span>
                                <span className="text-sm text-gray-700 break-all flex-1">{decodeURIComponent(fileName)}</span>
                                <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                              {isPdf && (
                                <div className="rounded-lg overflow-hidden border border-gray-200">
                                  <iframe
                                    src={`${message.content}#toolbar=0`}
                                    className="w-full h-64"
                                    title={fileName}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      )}
                      <div className={`text-xs mt-1 flex items-center justify-end gap-1 ${message.senderType === 'ADMIN' ? 'text-cyan-100' : 'text-gray-400'}`}>
                        <span>
                          {message.senderType === 'BOT' ? 'BOT ' : ''}{formatTime(message.createdAt)}
                        </span>
                        {/* 管理者/BOTが送ったメッセージに既読表示 */}
                        {(message.senderType === 'ADMIN' || message.senderType === 'BOT') && (
                          <span className={`flex items-center gap-0.5 ${message.isRead ? 'text-blue-400' : 'text-gray-400'}`}>
                            {message.isRead ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <svg className="w-4 h-4 -ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="ml-0.5">既読</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="ml-0.5">送信済</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {/* ユーザー入力中インジケーター */}
                {isUserTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-500">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <span className="text-sm">入力中...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area - 固定表示 */}
              <div className="bg-white border-t border-gray-200 p-2 md:p-4 flex-shrink-0 shadow-lg relative">
                {/* ナレッジ検索サジェスト */}
                {showKnowledgeSuggestions && knowledgeSuggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 md:mx-4 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-20">
                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium">ナレッジベース検索</span>
                        <button
                          onClick={() => setShowKnowledgeSuggestions(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {loadingKnowledge ? (
                      <div className="p-4 text-center text-gray-500">
                        <svg className="animate-spin w-5 h-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-xs">検索中...</span>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {knowledgeSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.type}-${suggestion.id}`}
                            onClick={() => selectKnowledgeSuggestion(suggestion)}
                            className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                suggestion.type === 'faq' ? 'bg-blue-100 text-blue-700' :
                                suggestion.type === 'template' ? 'bg-green-100 text-green-700' :
                                'bg-purple-100 text-purple-700'
                              }`}>
                                {suggestion.type === 'faq' ? 'FAQ' :
                                 suggestion.type === 'template' ? 'テンプレート' : 'シナリオ'}
                              </span>
                              {suggestion.category && (
                                <span className="text-xs text-gray-400">{suggestion.category}</span>
                              )}
                              <span className="text-xs text-gray-300 ml-auto">スコア: {suggestion.score}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-800 truncate">{suggestion.title}</p>
                            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{suggestion.content}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  {selectedConversation.status === 'WAITING' && (
                    <button
                      onClick={handleAssign}
                      className="flex-1 md:flex-none px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                    >
                      対応を開始
                    </button>
                  )}
                  {selectedConversation.status === 'HUMAN' && (
                    <button
                      onClick={handleClose}
                      className="px-3 md:px-4 py-2 bg-red-500 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-red-600 transition-colors"
                    >
                      終了
                    </button>
                  )}
                </div>
                {selectedConversation.status === 'HUMAN' ? (
                  <form onSubmit={handleSendMessage}>
                    {/* ファイルプレビュー */}
                    {pendingImage && (
                      <div className="flex items-center gap-3 mb-3 p-3 bg-gray-100 rounded-lg">
                        <div className="relative flex-shrink-0">
                          {pendingImage.isImage ? (
                            <img
                              src={pendingImage.previewUrl}
                              alt="プレビュー"
                              className="w-16 h-16 object-cover rounded-lg border border-gray-300"
                            />
                          ) : (
                            <div className="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-lg border border-gray-300 text-3xl">
                              {getFileIcon(pendingImage.file.name)}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={handleCancelImage}
                            className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <span className="text-sm text-gray-600 truncate flex-1">{pendingImage.file.name}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/heic,application/pdf,.doc,.docx,.xls,.xlsx"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                      >
                        {uploadingImage ? (
                          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                      <textarea
                        value={inputValue}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="メッセージを入力... ( / でナレッジ検索)"
                        className="flex-1 px-3 md:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none text-base"
                        rows={1}
                        disabled={uploadingImage}
                        style={{ minHeight: '42px', maxHeight: '120px' }}
                      />
                      <button
                        type="submit"
                        disabled={uploadingImage || (!inputValue.trim() && !pendingImage)}
                        className="p-2 md:px-6 md:py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
                        aria-label="送信"
                      >
                        <span className="hidden md:inline">{uploadingImage ? '送信中...' : '送信'}</span>
                        <svg className="w-5 h-5 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="text-center text-gray-400 py-4 border border-gray-200 rounded-lg">
                    ユーザーが有人チャットに接続していません
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              会話を選択してください
            </div>
          )}
        </div>

        {/* Right Sidebar - User Info / Templates */}
        {selectedConversation && (
          <div className={`w-full md:w-80 bg-white border-l border-gray-200 overflow-y-auto ${mobileView !== 'info' ? 'hidden md:block' : 'block'}`}>
            {/* Mobile Header */}
            <div className="md:hidden flex items-center gap-3 p-3 border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setMobileView('chat')}
                className="p-2 -ml-1 text-gray-600 hover:text-gray-900"
                aria-label="チャットに戻る"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-medium text-gray-800">ユーザー情報</h2>
            </div>
            {/* Tab Headers */}
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setRightTab('user')}
                  className={`flex-1 px-4 py-3 text-sm font-medium ${
                    rightTab === 'user'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  ユーザ情報
                </button>
                <button
                  onClick={() => setRightTab('template')}
                  className={`flex-1 px-4 py-3 text-sm font-medium ${
                    rightTab === 'template'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  応答テンプレート
                </button>
              </div>
            </div>

            {rightTab === 'template' ? (
              <div className="p-4">
                <div className="mb-3">
                  <select
                    value={selectedTemplateCategory}
                    onChange={(e) => setSelectedTemplateCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {templateCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'all' ? 'すべてのカテゴリ' : cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-primary hover:bg-primary-light transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                          {template.code}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{template.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">{template.content}</p>
                    </div>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <div className="text-center text-gray-400 py-4">テンプレートがありません</div>
                  )}
                </div>
              </div>
            ) : (
            <div className="p-4">
              <h3 className="font-medium text-gray-800 mb-4">ユーザ情報</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">名前：</label>
                  {userInfoEditing ? (
                    <input
                      type="text"
                      value={editedUser.name || ''}
                      onChange={(e) => setEditedUser({ ...editedUser, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  ) : (
                    <div className="text-sm text-gray-800 border-b border-gray-200 pb-2">
                      {selectedConversation.user.name || ''}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">メール：</label>
                  {userInfoEditing ? (
                    <input
                      type="email"
                      value={editedUser.email || ''}
                      onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  ) : (
                    <div className="text-sm text-gray-800 border-b border-gray-200 pb-2">
                      {selectedConversation.user.email || ''}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">電話番号：</label>
                  {userInfoEditing ? (
                    <input
                      type="tel"
                      value={editedUser.phone || ''}
                      onChange={(e) => setEditedUser({ ...editedUser, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  ) : (
                    <div className="text-sm text-gray-800 border-b border-gray-200 pb-2">
                      {selectedConversation.user.phone || ''}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">会社：</label>
                  {userInfoEditing ? (
                    <input
                      type="text"
                      value={editedUser.company || ''}
                      onChange={(e) => setEditedUser({ ...editedUser, company: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  ) : (
                    <div className="text-sm text-gray-800 border-b border-gray-200 pb-2">
                      {selectedConversation.user.company || ''}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">メモ：</label>
                  {userInfoEditing ? (
                    <textarea
                      value={editedUser.memo || ''}
                      onChange={(e) => setEditedUser({ ...editedUser, memo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      rows={3}
                    />
                  ) : (
                    <div className="text-sm text-gray-800 border-b border-gray-200 pb-2 min-h-[60px]">
                      {selectedConversation.user.memo || ''}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ラベル：</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(userInfoEditing ? editedUser.labels : selectedConversation.user.labels || [])?.map((label, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs flex items-center gap-1">
                        {label}
                        {userInfoEditing && (
                          <button
                            onClick={() => {
                              setEditedUser((prev) => ({
                                ...prev,
                                labels: (prev.labels || []).filter((_, idx) => idx !== i),
                              }));
                            }}
                            className="text-gray-400 hover:text-red-500 ml-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  {userInfoEditing && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="ラベル"
                        className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                      />
                      <button
                        onClick={handleAddLabel}
                        className="px-3 py-1 bg-primary text-white rounded text-sm"
                      >
                        追加
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                {userInfoEditing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateUser}
                      className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => {
                        setUserInfoEditing(false);
                        // 編集内容をリセット
                        if (selectedConversation) {
                          setEditedUser({
                            name: selectedConversation.user.name || '',
                            email: selectedConversation.user.email || '',
                            phone: selectedConversation.user.phone || '',
                            company: selectedConversation.user.company || '',
                            memo: selectedConversation.user.memo || '',
                            labels: selectedConversation.user.labels || [],
                          });
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setUserInfoEditing(true)}
                    className="w-full px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                  >
                    編集
                  </button>
                )}
              </div>

              <hr className="my-4" />

              {/* 会話品質スコア */}
              <h3 className="font-medium text-gray-800 mb-4">会話品質スコア</h3>
              {loadingQualityScore ? (
                <div className="text-center text-gray-500 py-4">
                  <svg className="animate-spin w-6 h-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm">計算中...</span>
                </div>
              ) : qualityScore ? (
                <div className="space-y-3">
                  {/* 総合スコア */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 border border-blue-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">総合スコア</span>
                      <span className={`text-2xl font-bold ${
                        qualityScore.overallScore >= 70 ? 'text-green-600' :
                        qualityScore.overallScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>{qualityScore.overallScore}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          qualityScore.overallScore >= 70 ? 'bg-green-500' :
                          qualityScore.overallScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${qualityScore.overallScore}%` }}
                      />
                    </div>
                  </div>

                  {/* 詳細スコア */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-500 mb-1">応答速度</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${qualityScore.responseTimeScore}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{qualityScore.responseTimeScore}</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-500 mb-1">解決度</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${qualityScore.resolutionScore}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{qualityScore.resolutionScore}</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-500 mb-1">センチメント</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${qualityScore.sentimentScore}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{qualityScore.sentimentScore}</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-500 mb-1">エンゲージメント</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${qualityScore.engagementScore}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{qualityScore.engagementScore}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-4 text-sm">スコアなし</div>
              )}

              <hr className="my-4" />

              <h3 className="font-medium text-gray-800 mb-4">閲覧中のページ：</h3>
              <div className="bg-gray-50 rounded-lg p-3">
                {metadata.lastTitle || metadata.lastUrl ? (
                  <>
                    <p className="text-sm text-gray-800 font-medium">
                      {metadata.lastTitle || '（タイトル未取得）'}
                    </p>
                    {metadata.lastUrl && (
                      <a
                        href={metadata.lastUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline break-all mt-2 block"
                      >
                        {metadata.lastUrl}
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">未取得</p>
                )}
              </div>

              <hr className="my-4" />

              <h3 className="font-medium text-gray-800 mb-4">環境情報</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">ブラウザ：</span>
                  <span className="text-gray-800">{metadata.browser || '未取得'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">OS：</span>
                  <span className="text-gray-800">{metadata.os || '未取得'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">デバイス：</span>
                  <span className="text-gray-800">{metadata.deviceType || '未取得'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IPアドレス：</span>
                  <span className="text-gray-800">{metadata.ipAddress || '未取得'}</span>
                </div>
              </div>
            </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
