import { useState, useEffect, useRef } from 'preact/hooks';
import { io, Socket } from 'socket.io-client';
import { WS_EVENTS, MESSAGES } from '@crossbot/shared';
import { ChatHeader } from './ChatHeader';
import { ChatTimeline } from './ChatTimeline';
import { ChatOptions } from './ChatOptions';
import { ChatInput } from './ChatInput';
import { ChatLauncher } from './ChatLauncher';

interface WidgetConfig {
  siteId?: string;
  apiUrl?: string;
  wsUrl?: string;
}

interface Message {
  id: string;
  senderType: 'USER' | 'ADMIN' | 'BOT' | 'SYSTEM';
  contentType: string;
  content: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

interface ScenarioOption {
  nodeId: number;
  label: string;
}

type ConversationStatus = 'BOT' | 'WAITING' | 'HUMAN' | 'CLOSED';

export function ChatWidget({ config }: { config: WidgetConfig }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [options, setOptions] = useState<ScenarioOption[]>([]);
  const [status, setStatus] = useState<ConversationStatus>('BOT');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // セッションIDの取得・生成
  const getSessionId = (): string => {
    let sessionId = localStorage.getItem('crossbot_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('crossbot_session_id', sessionId);
    }
    return sessionId;
  };

  // WebSocket接続
  useEffect(() => {
    if (!isOpen) return;

    const wsUrl = config.wsUrl || 'http://localhost:3000';
    const socket = io(`${wsUrl}/chat`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to chat server');

      // ルームに参加
      socket.emit(WS_EVENTS.JOIN_ROOM, {
        sessionId: getSessionId(),
        conversationId: conversationId,
        userContext: {
          url: window.location.href,
          title: document.title,
          userAgent: navigator.userAgent,
          // LMSユーザー情報があれば追加
          lmsUser: (window as unknown as Record<string, unknown>).crossLearningUser as { id: string; name: string; email?: string } | undefined,
        },
      });
    });

    socket.on(WS_EVENTS.CONNECTION_ACK, (data: { userId: string; conversationId: string; status: ConversationStatus; scenario: { message: string; options: ScenarioOption[] } }) => {
      setUserId(data.userId);
      setConversationId(data.conversationId);
      setStatus(data.status);

      if (data.scenario) {
        // 初期メッセージを追加
        addMessage({
          id: crypto.randomUUID(),
          senderType: 'BOT',
          contentType: 'TEXT',
          content: data.scenario.message,
          createdAt: new Date().toISOString(),
        });
        setOptions(data.scenario.options);
      }
    });

    socket.on(WS_EVENTS.NEW_MESSAGE, (message: Message) => {
      addMessage(message);
    });

    socket.on(WS_EVENTS.SCENARIO_RESPONSE, (response: { message: string; options: ScenarioOption[]; action?: string }) => {
      if (response.message) {
        addMessage({
          id: crypto.randomUUID(),
          senderType: 'BOT',
          contentType: 'TEXT',
          content: response.message,
          createdAt: new Date().toISOString(),
        });
      }
      setOptions(response.options);

      if (response.action === 'HANDOVER') {
        setStatus('WAITING');
      }
    });

    socket.on(WS_EVENTS.STATUS_CHANGE, (data: { status: ConversationStatus }) => {
      setStatus(data.status);
      if (data.status === 'HUMAN') {
        addMessage({
          id: crypto.randomUUID(),
          senderType: 'SYSTEM',
          contentType: 'TEXT',
          content: 'オペレーターが対応を開始しました。',
          createdAt: new Date().toISOString(),
        });
      }
    });

    socket.on(WS_EVENTS.TYPING_INDICATOR, (data: { isTyping: boolean }) => {
      if (data.isTyping) {
        setIsTyping(true);
      } else {
        setIsTyping(false);
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from chat server');
    });

    return () => {
      socket.disconnect();
    };
  }, [isOpen, config.wsUrl, conversationId]);

  // ページ遷移の監視
  useEffect(() => {
    if (!socketRef.current || !userId) return;

    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        socketRef.current?.emit(WS_EVENTS.PAGE_VIEW, {
          userId,
          url: location.href,
          title: document.title,
        });
      }
    });

    observer.observe(document, { subtree: true, childList: true });

    return () => observer.disconnect();
  }, [userId]);

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const handleOptionSelect = (nodeId: number) => {
    if (!socketRef.current || !conversationId) return;

    // 選択した選択肢のラベルを取得
    const selectedOption = options.find((o) => o.nodeId === nodeId);
    if (selectedOption) {
      addMessage({
        id: crypto.randomUUID(),
        senderType: 'USER',
        contentType: 'OPTION_SELECT',
        content: selectedOption.label,
        createdAt: new Date().toISOString(),
      });
    }

    socketRef.current.emit(WS_EVENTS.SELECT_OPTION, {
      conversationId,
      nodeId,
    });

    setOptions([]);
  };

  const handleSendMessage = (content: string) => {
    if (!socketRef.current || !conversationId || status === 'BOT') return;

    addMessage({
      id: crypto.randomUUID(),
      senderType: 'USER',
      contentType: 'TEXT',
      content,
      createdAt: new Date().toISOString(),
    });

    socketRef.current.emit(WS_EVENTS.SEND_MESSAGE, {
      conversationId,
      contentType: 'TEXT',
      content,
    });
  };

  const handleTyping = (isTyping: boolean) => {
    if (!socketRef.current || !conversationId) return;

    socketRef.current.emit(WS_EVENTS.TYPING, {
      conversationId,
      senderType: 'USER',
      isTyping,
    });
  };

  return (
    <>
      {isOpen ? (
        <div class="widget-window">
          <ChatHeader status={status} onClose={() => setIsOpen(false)} />
          <ChatTimeline messages={messages} isTyping={isTyping} />
          {options.length > 0 && (
            <ChatOptions options={options} onSelect={handleOptionSelect} />
          )}
          <ChatInput
            disabled={status === 'BOT'}
            placeholder={status === 'BOT' ? '選択肢からお選びください' : 'メッセージを入力...'}
            onSend={handleSendMessage}
            onTyping={handleTyping}
          />
        </div>
      ) : null}
      <ChatLauncher onClick={() => setIsOpen(!isOpen)} isOpen={isOpen} />
    </>
  );
}
