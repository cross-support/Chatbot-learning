import { useRef, useCallback } from 'preact/hooks';
import { RefObject } from 'preact';
import { io, Socket } from 'socket.io-client';
import { WS_EVENTS } from '@crossbot/shared';

// Types
export interface Message {
  id: string;
  senderType: 'USER' | 'ADMIN' | 'BOT' | 'SYSTEM';
  contentType: string;
  content: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  isRead?: boolean;
}

export interface ScenarioOption {
  nodeId: number;
  label: string;
  type?: 'go_to' | 'button' | 'link';
  linkTarget?: string;
}

export interface ScenarioHistoryItem {
  nodeId: number | null;
  options: ScenarioOption[];
}

export type ConversationStatus = 'BOT' | 'WAITING' | 'HUMAN' | 'CLOSED';

interface ConnectionAckData {
  userId: string;
  conversationId: string;
  status: ConversationStatus;
  scenario: { message: string; options: ScenarioOption[] };
}

interface ScenarioResponseData {
  message?: string;
  messages?: Array<{ text: string; type: string }>;
  options: ScenarioOption[];
  action?: string;
  actionValue?: string;
  actionConfig?: Record<string, unknown>;
  nodeId?: number;
}

interface StatusChangeData {
  status: ConversationStatus;
}

interface TypingData {
  isTyping: boolean;
  senderType?: string;
}

interface MessagesReadData {
  conversationId: string;
  readBy: string;
}

interface CsvExportResult {
  success: boolean;
  csv?: string;
  filename?: string;
  error?: string;
}

interface MailSendResult {
  success: boolean;
  error?: string;
}

// Callbacks interface
export interface SocketCallbacks {
  onConnectionAck: (data: ConnectionAckData) => void;
  onNewMessage: (message: Message) => void;
  onScenarioResponse: (response: ScenarioResponseData) => void;
  onStatusChange: (data: StatusChangeData) => void;
  onTypingIndicator: (data: TypingData) => void;
  onMessagesRead: (data: MessagesReadData) => void;
  onCsvExportResult: (result: CsvExportResult) => void;
  onMailSendResult: (result: MailSendResult) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

// Hook result interface
export interface UseChatSocketResult {
  socketRef: RefObject<Socket | null>;
  connect: (wsUrl: string, sessionId: string, conversationId: string | null, userContext: unknown, forceNew?: boolean) => void;
  disconnect: () => void;
  emit: (event: string, data: unknown) => void;
  isConnected: () => boolean;
}

/**
 * ソケットイベントリスナーを設定
 */
function setupSocketListeners(socket: Socket, callbacks: SocketCallbacks): void {
  socket.on('connect', () => {
    callbacks.onConnect();
  });

  socket.on(WS_EVENTS.CONNECTION_ACK, (data: ConnectionAckData) => {
    callbacks.onConnectionAck(data);
  });

  socket.on(WS_EVENTS.NEW_MESSAGE, (message: Message) => {
    callbacks.onNewMessage(message);
  });

  socket.on(WS_EVENTS.SCENARIO_RESPONSE, (response: ScenarioResponseData) => {
    callbacks.onScenarioResponse(response);
  });

  socket.on(WS_EVENTS.STATUS_CHANGE, (data: StatusChangeData) => {
    callbacks.onStatusChange(data);
  });

  socket.on(WS_EVENTS.TYPING_INDICATOR, (data: TypingData) => {
    callbacks.onTypingIndicator(data);
  });

  socket.on(WS_EVENTS.ALL_MESSAGES_READ, (data: MessagesReadData) => {
    callbacks.onMessagesRead(data);
  });

  socket.on('csv_export_result', (result: CsvExportResult) => {
    callbacks.onCsvExportResult(result);
  });

  socket.on('mail_send_result', (result: MailSendResult) => {
    callbacks.onMailSendResult(result);
  });

  socket.on('disconnect', () => {
    callbacks.onDisconnect();
  });
}

/**
 * チャットソケット管理用カスタムフック
 */
export function useChatSocket(callbacks: SocketCallbacks): UseChatSocketResult {
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback((
    wsUrl: string,
    sessionId: string,
    conversationId: string | null,
    userContext: unknown,
    forceNew: boolean = false
  ) => {
    // 既存のソケットがあれば切断
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(`${wsUrl}/chat`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // イベントリスナーを設定
    setupSocketListeners(socket, callbacks);

    // connect時にルームに参加
    socket.on('connect', () => {
      socket.emit(WS_EVENTS.JOIN_ROOM, {
        sessionId,
        conversationId: forceNew ? null : conversationId,
        forceNewConversation: forceNew,
        userContext,
      });
    });
  }, [callbacks]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const emit = useCallback((event: string, data: unknown) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const isConnected = useCallback(() => {
    return socketRef.current?.connected ?? false;
  }, []);

  return {
    socketRef,
    connect,
    disconnect,
    emit,
    isConnected,
  };
}

/**
 * CSVダウンロードヘルパー
 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * システムメッセージ作成ヘルパー
 */
export function createSystemMessage(content: string): Message {
  return {
    id: crypto.randomUUID(),
    senderType: 'SYSTEM',
    contentType: 'TEXT',
    content,
    createdAt: new Date().toISOString(),
  };
}

/**
 * BOTメッセージ作成ヘルパー
 */
export function createBotMessage(content: string): Message {
  return {
    id: crypto.randomUUID(),
    senderType: 'BOT',
    contentType: 'TEXT',
    content,
    createdAt: new Date().toISOString(),
  };
}

/**
 * ユーザーメッセージ作成ヘルパー
 */
export function createUserMessage(content: string, contentType: string = 'TEXT', payload?: Record<string, unknown>): Message {
  return {
    id: crypto.randomUUID(),
    senderType: 'USER',
    contentType,
    content,
    payload,
    createdAt: new Date().toISOString(),
  };
}
