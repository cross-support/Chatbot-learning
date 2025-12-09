import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { io, Socket } from 'socket.io-client';
import { WS_EVENTS } from '@crossbot/shared';
import { ChatHeader } from './ChatHeader';
import { ChatTimeline } from './ChatTimeline';
import { ChatInput } from './ChatInput';
import { ChatLauncher } from './ChatLauncher';
import { OffHoursForm, OffHoursSuccessMessage } from './OffHoursForm';
import { DynamicForm, FormConfig, getDefaultFormConfig } from './DynamicForm';
import { SatisfactionSurvey } from './SatisfactionSurvey';
import { DebugRolePanel } from './DebugRolePanel';
import { useWidgetNotification } from '../hooks/useWidgetNotification';

interface WidgetConfig {
  siteId?: string;
  apiUrl?: string;
  wsUrl?: string;
}

interface WidgetAppearance {
  botIconUrl?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerColor?: string;
  headerTextColor?: string;
  primaryColor?: string;
}

interface Message {
  id: string;
  senderType: 'USER' | 'ADMIN' | 'BOT' | 'SYSTEM';
  contentType: string;
  content: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  isRead?: boolean;
}

interface ScenarioOption {
  nodeId: number;
  label: string;
  type?: 'go_to' | 'button' | 'link';
  linkTarget?: string;
}

interface ScenarioHistoryItem {
  nodeId: number | null;
  options: ScenarioOption[];
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
  const [scenarioHistory, setScenarioHistory] = useState<ScenarioHistoryItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOffHours, setIsOffHours] = useState(false);
  const [offHoursFormSubmitted, setOffHoursFormSubmitted] = useState(false);
  const [offHoursSubmittedData, setOffHoursSubmittedData] = useState<{ name: string; email: string } | null>(null);
  const [checkingBusinessHours, setCheckingBusinessHours] = useState(true);
  const [appearance, setAppearance] = useState<WidgetAppearance>({});
  const [showOffHoursForm, setShowOffHoursForm] = useState(false); // オペレーター接続要求時に表示
  const [showDynamicForm, setShowDynamicForm] = useState(false); // 動的フォーム表示
  const [dynamicFormConfig, setDynamicFormConfig] = useState<FormConfig | null>(null); // フォーム設定
  const [isFormSubmitting, setIsFormSubmitting] = useState(false); // フォーム送信中
  const [showSurvey, setShowSurvey] = useState(false); // 満足度アンケート表示
  const [surveyCompleted, setSurveyCompleted] = useState(false); // アンケート完了済み
  const socketRef = useRef<Socket | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const isOpenRef = useRef(false);
  const { notifyNewMessage } = useWidgetNotification();

  // ウィジェット設定を取得（siteIdに基づく）
  useEffect(() => {
    const fetchWidgetConfig = async () => {
      try {
        const apiUrl = config.apiUrl || 'http://localhost:3000';
        const siteId = config.siteId || 'default';

        // siteIdに基づいてアプリケーション設定を取得
        const response = await fetch(`${apiUrl}/api/public/app/${siteId}/config`);
        if (response.ok) {
          const data = await response.json();
          // ウィジェット設定を適用
          setAppearance({
            botIconUrl: data.botIconUrl,
            headerTitle: data.headerTitle,
            headerSubtitle: data.headerSubtitle,
            headerColor: data.headerColor,
            headerTextColor: data.headerTextColor,
            primaryColor: data.primaryColor,
          });
        } else {
          // フォールバック: 従来のエンドポイント
          const fallbackResponse = await fetch(`${apiUrl}/api/public/settings/widget-config`);
          if (fallbackResponse.ok) {
            const data = await fallbackResponse.json();
            setAppearance(data);
          }
        }
      } catch {
        // Widget config fetch failed - use defaults
      }
    };

    fetchWidgetConfig();
  }, [config.apiUrl, config.siteId]);

  // isOpenの状態をrefに同期
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // 営業時間チェック（siteIdに基づく）
  useEffect(() => {
    if (!isOpen) return;

    const checkBusinessHours = async () => {
      try {
        const apiUrl = config.apiUrl || 'http://localhost:3000';
        const siteId = config.siteId || 'default';

        // siteIdに基づいて営業時間を取得
        const response = await fetch(`${apiUrl}/api/public/app/${siteId}/business-hours`);
        if (response.ok) {
          const data = await response.json();
          setIsOffHours(!data.isOpen);
        } else {
          // フォールバック: 従来のエンドポイント
          const fallbackResponse = await fetch(`${apiUrl}/api/public/settings/business-hours`);
          if (fallbackResponse.ok) {
            const data = await fallbackResponse.json();
            setIsOffHours(!data.isOpen);
          }
        }
      } catch {
        // Business hours check failed - assume open
        setIsOffHours(false);
      } finally {
        setCheckingBusinessHours(false);
      }
    };

    checkBusinessHours();
  }, [isOpen, config.apiUrl, config.siteId]);

  // セッションIDの取得・生成
  const getSessionId = useCallback((): string => {
    let sessionId = localStorage.getItem('crossbot_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('crossbot_session_id', sessionId);
    }
    return sessionId;
  }, []);

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
      // ルームに参加
      socket.emit(WS_EVENTS.JOIN_ROOM, {
        sessionId: getSessionId(),
        conversationId: conversationIdRef.current,
        siteId: config.siteId || 'default', // アプリケーション識別用
        userContext: {
          url: window.location.href,
          title: document.title,
          userAgent: navigator.userAgent,
          // LMSユーザー情報があれば追加（ロール情報含む）
          lmsUser: (window as unknown as Record<string, unknown>).crossLearningUser as { id: string; name: string; email?: string; role?: 'learner' | 'group_admin' | 'global_admin' } | undefined,
        },
      });
    });

    socket.on(WS_EVENTS.CONNECTION_ACK, (data: { userId: string; conversationId: string; status: ConversationStatus; scenario: { message: string; options: ScenarioOption[] } }) => {
      setUserId(data.userId);
      setConversationId(data.conversationId);
      conversationIdRef.current = data.conversationId;
      setStatus(data.status);

      // ユーザーが会話を開いた時に、管理者/BOTのメッセージを既読としてマーク
      socket.emit(WS_EVENTS.MARK_READ, {
        conversationId: data.conversationId,
        senderType: 'USER',
      });

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
        // 初期状態を履歴に保存
        setScenarioHistory([{ nodeId: null, options: data.scenario.options }]);
      }
    });

    socket.on(WS_EVENTS.NEW_MESSAGE, (message: Message) => {
      addMessage(message);

      // 管理者またはBOTからのメッセージの場合
      if (message.senderType === 'ADMIN' || message.senderType === 'BOT') {
        const senderName = message.senderType === 'ADMIN' ? 'オペレーター' : 'サポート';
        // ウィジェットが閉じている場合は通知カウント増加とブラウザ通知
        if (!isOpenRef.current) {
          notifyNewMessage(senderName, message.content);
          setUnreadCount((prev) => prev + 1);
        } else {
          // 開いている場合でも音を鳴らす
          notifyNewMessage(senderName, message.content);
        }
      }
    });

    socket.on(WS_EVENTS.SCENARIO_RESPONSE, (response: { message?: string; messages?: Array<{ text: string; type: string }>; options: ScenarioOption[]; action?: string; actionValue?: string; actionConfig?: Record<string, unknown>; nodeId?: number }) => {
      // 新形式（messages配列）をサポート
      if (response.messages && response.messages.length > 0) {
        const combinedText = response.messages.map(m => m.text).join('\n\n');
        addMessage({
          id: crypto.randomUUID(),
          senderType: 'BOT',
          contentType: 'TEXT',
          content: combinedText,
          createdAt: new Date().toISOString(),
        });
        // 応答受信時に音を鳴らす
        notifyNewMessage('サポート', combinedText);
      } else if (response.message) {
        // 旧形式との互換性
        addMessage({
          id: crypto.randomUUID(),
          senderType: 'BOT',
          contentType: 'TEXT',
          content: response.message,
          createdAt: new Date().toISOString(),
        });
        // 応答受信時に音を鳴らす
        notifyNewMessage('サポート', response.message);
      }
      setOptions(response.options);

      // 選択肢がある場合は履歴に追加（重複チェック）
      if (response.options && response.options.length > 0 && response.nodeId !== undefined) {
        const nodeIdValue = response.nodeId; // TypeScript用に変数に格納
        setScenarioHistory(prev => {
          // 既に同じnodeIdが存在する場合は追加しない
          const exists = prev.some(item => item.nodeId === nodeIdValue);
          if (exists) {
            return prev;
          }
          return [...prev, { nodeId: nodeIdValue, options: response.options }];
        });
      }

      if (response.action === 'HANDOVER') {
        // 営業時間外の場合は時間外フォームを表示
        if (isOffHours) {
          setShowOffHoursForm(true);
          addMessage({
            id: crypto.randomUUID(),
            senderType: 'SYSTEM',
            contentType: 'TEXT',
            content: '現在は営業時間外です。お問い合わせフォームからご連絡ください。',
            createdAt: new Date().toISOString(),
          });
        } else {
          setStatus('WAITING');
        }
      } else if (response.action === 'LINK' && response.actionValue) {
        // LINKアクション: 新しいタブでURLを開く
        window.open(response.actionValue, '_blank', 'noopener,noreferrer');
      } else if (response.action === 'FORM') {
        // FORMアクション: 動的フォームを表示
        const formId = response.actionValue || 'contact';
        const formConfig = response.actionConfig as FormConfig | undefined;
        if (formConfig && formConfig.fields) {
          setDynamicFormConfig(formConfig);
        } else {
          const defaultConfig = getDefaultFormConfig(formId);
          setDynamicFormConfig(defaultConfig);
        }
        setShowDynamicForm(true);
      } else if (response.action === 'CSV') {
        // CSVアクション: 会話履歴をCSV出力
        const csvConfig = response.actionConfig as { type?: string } | undefined;
        if (conversationId && socketRef.current) {
          socketRef.current.emit('export_csv', {
            conversationId,
            type: csvConfig?.type || 'conversation',
          });
        }
      } else if (response.action === 'MAIL') {
        // MAILアクション: シナリオからのメール送信
        const mailConfig = response.actionConfig as { to?: string; subject?: string; body?: string } | undefined;
        if (conversationId && socketRef.current && mailConfig) {
          socketRef.current.emit('send_scenario_mail', {
            conversationId,
            config: {
              to: mailConfig.to,
              subject: mailConfig.subject || 'チャットボットからの通知',
              body: mailConfig.body || '',
            },
          });
        }
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
      } else if (data.status === 'CLOSED' && !surveyCompleted) {
        // チャット終了時に満足度アンケートを表示
        setShowSurvey(true);
      }
    });

    socket.on(WS_EVENTS.TYPING_INDICATOR, (data: { isTyping: boolean; senderType?: string }) => {
      // 管理者またはBOTの入力中を表示（ユーザー自身の入力中は無視）
      if (data.senderType !== 'USER') {
        setIsTyping(data.isTyping);
      }
    });

    // 既読通知
    socket.on(WS_EVENTS.ALL_MESSAGES_READ, (data: { conversationId: string; readBy: string }) => {
      // 管理者がユーザーのメッセージを既読にした場合
      if (data.readBy === 'ADMIN') {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderType === 'USER' ? { ...m, isRead: true } : m
          )
        );
      }
    });

    // CSVエクスポート結果を受信
    socket.on('csv_export_result', (result: { success: boolean; csv?: string; filename?: string; error?: string }) => {
      if (result.success && result.csv && result.filename) {
        // CSVをダウンロード
        const blob = new Blob(['\uFEFF' + result.csv], { type: 'text/csv;charset=utf-8;' }); // BOM付きUTF-8
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        addMessage({
          id: crypto.randomUUID(),
          senderType: 'SYSTEM',
          contentType: 'TEXT',
          content: `CSVファイル「${result.filename}」をダウンロードしました。`,
          createdAt: new Date().toISOString(),
        });
      } else {
        addMessage({
          id: crypto.randomUUID(),
          senderType: 'SYSTEM',
          contentType: 'TEXT',
          content: result.error || 'CSVエクスポートに失敗しました。',
          createdAt: new Date().toISOString(),
        });
      }
    });

    // メール送信結果を受信
    socket.on('mail_send_result', (result: { success: boolean; error?: string }) => {
      if (result.success) {
        addMessage({
          id: crypto.randomUUID(),
          senderType: 'SYSTEM',
          contentType: 'TEXT',
          content: 'メールを送信しました。',
          createdAt: new Date().toISOString(),
        });
      } else {
        addMessage({
          id: crypto.randomUUID(),
          senderType: 'SYSTEM',
          contentType: 'TEXT',
          content: result.error || 'メール送信に失敗しました。',
          createdAt: new Date().toISOString(),
        });
      }
    });

    socket.on('disconnect', () => {
      // Disconnected from chat server
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, config.wsUrl]);

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

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

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

  const handleSendMessage = (content: string, contentType: string = 'TEXT') => {
    if (!socketRef.current || !conversationId) {
      return;
    }

    // シナリオモード中でもテキスト送信を許可（AI応答を受け取る）
    socketRef.current.emit(WS_EVENTS.SEND_MESSAGE, {
      conversationId,
      contentType,
      content,
    });

    // テキスト入力したら選択肢をクリア（AIモードに移行）
    if (options.length > 0 && contentType === 'TEXT') {
      setOptions([]);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (!socketRef.current || !conversationId) return;

    socketRef.current.emit(WS_EVENTS.TYPING, {
      conversationId,
      senderType: 'USER',
      isTyping,
    });
  };

  // チャット終了ハンドラ
  const handleEndChat = () => {
    if (!socketRef.current || !conversationId) return;

    // 確認ダイアログ
    if (!window.confirm('チャットを終了しますか？')) return;

    socketRef.current.emit(WS_EVENTS.USER_CLOSE_CHAT, {
      conversationId,
    });
  };

  // 戻るボタンのハンドラ
  const handleGoBack = () => {
    if (scenarioHistory.length <= 1) return;

    // 現在の状態を削除し、一つ前の状態に戻る
    const newHistory = scenarioHistory.slice(0, -1);
    const previousState = newHistory[newHistory.length - 1];

    setScenarioHistory(newHistory);
    setOptions(previousState.options);

    // 戻る操作をメッセージとして追加
    addMessage({
      id: crypto.randomUUID(),
      senderType: 'SYSTEM',
      contentType: 'TEXT',
      content: '前の選択肢に戻りました',
      createdAt: new Date().toISOString(),
    });
  };

  // 戻れるかどうか
  const canGoBack = scenarioHistory.length > 1 && status === 'BOT';

  // 営業時間外の場合は自由入力を無効化（シナリオ選択肢のみ利用可能）
  const isInputDisabled = isOffHours;

  // プレースホルダーテキスト
  const placeholder = useMemo(() => {
    if (isOffHours) {
      return '営業時間外のため選択肢からお選びください';
    }
    if (status === 'BOT' && options.length > 0) {
      return '選択肢を選ぶか、直接質問を入力...';
    }
    if (status === 'WAITING') {
      return 'オペレーター接続中...メッセージを入力できます';
    }
    return 'メッセージを入力...';
  }, [isOffHours, status, options.length]);

  // 時間外フォーム送信成功ハンドラ
  const handleOffHoursSuccess = (data: { name: string; email: string }) => {
    setOffHoursSubmittedData(data);
    setOffHoursFormSubmitted(true);
  };

  // 時間外フォームを閉じるハンドラ
  const handleCloseOffHours = () => {
    setIsOpen(false);
    // 次回開いた時のためにリセット
    setOffHoursFormSubmitted(false);
    setShowOffHoursForm(false);
  };

  // 時間外フォームからチャットに戻るハンドラ
  const handleBackToChat = () => {
    setShowOffHoursForm(false);
    setOffHoursFormSubmitted(false);
  };

  // 動的フォーム送信ハンドラ
  const handleDynamicFormSubmit = async (data: Record<string, unknown>) => {
    if (!socketRef.current || !conversationId) return;

    setIsFormSubmitting(true);
    try {
      // フォームデータをメッセージとして送信
      const formSummary = Object.entries(data)
        .filter(([, value]) => value !== '' && value !== undefined && value !== null)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      // ユーザーメッセージとして表示
      addMessage({
        id: crypto.randomUUID(),
        senderType: 'USER',
        contentType: 'FORM',
        content: `フォーム送信:\n${formSummary}`,
        payload: { formData: data, formId: dynamicFormConfig?.formId },
        createdAt: new Date().toISOString(),
      });

      // サーバーにフォームデータを送信
      socketRef.current.emit('form_submit', {
        conversationId,
        formId: dynamicFormConfig?.formId,
        formData: data,
      });

      // システムメッセージ
      addMessage({
        id: crypto.randomUUID(),
        senderType: 'SYSTEM',
        contentType: 'TEXT',
        content: 'フォームを送信しました。',
        createdAt: new Date().toISOString(),
      });

      // フォームを閉じる
      setShowDynamicForm(false);
      setDynamicFormConfig(null);
    } catch {
      addMessage({
        id: crypto.randomUUID(),
        senderType: 'SYSTEM',
        contentType: 'TEXT',
        content: 'フォームの送信に失敗しました。',
        createdAt: new Date().toISOString(),
      });
    } finally {
      setIsFormSubmitting(false);
    }
  };

  // 動的フォームをキャンセル
  const handleDynamicFormCancel = () => {
    setShowDynamicForm(false);
    setDynamicFormConfig(null);
  };

  // 満足度アンケート完了ハンドラ
  const handleSurveyComplete = () => {
    setShowSurvey(false);
    setSurveyCompleted(true);
  };

  // 満足度アンケートスキップハンドラ
  const handleSurveySkip = () => {
    setShowSurvey(false);
    setSurveyCompleted(true); // スキップしても再表示しない
  };

  // 新しいチャットを開始するハンドラ
  const handleNewChat = () => {
    if (!window.confirm('新しいチャットを開始しますか？\n現在の会話は終了します。')) return;

    // 状態をリセット
    setMessages([]);
    setOptions([]);
    setStatus('BOT');
    setScenarioHistory([]);
    setConversationId(null);
    conversationIdRef.current = null;
    setShowOffHoursForm(false);
    setOffHoursFormSubmitted(false);

    // 現在のソケット接続を切断して再接続（forceNewConversationフラグ付き）
    if (socketRef.current) {
      socketRef.current.disconnect();

      const wsUrl = config.wsUrl || 'http://localhost:3000';
      const socket = io(`${wsUrl}/chat`, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        // 新しい会話を強制作成
        socket.emit(WS_EVENTS.JOIN_ROOM, {
          sessionId: getSessionId(),
          forceNewConversation: true, // 新しい会話を強制作成
          siteId: config.siteId || 'default', // アプリケーション識別用
          userContext: {
            url: window.location.href,
            title: document.title,
            userAgent: navigator.userAgent,
            lmsUser: (window as unknown as Record<string, unknown>).crossLearningUser as { id: string; name: string; email?: string; role?: 'learner' | 'group_admin' | 'global_admin' } | undefined,
          },
        });
      });

      // イベントリスナーを再設定
      socket.on(WS_EVENTS.CONNECTION_ACK, (data: { userId: string; conversationId: string; status: ConversationStatus; scenario: { message: string; options: ScenarioOption[] } }) => {
        setUserId(data.userId);
        setConversationId(data.conversationId);
        conversationIdRef.current = data.conversationId;
        setStatus(data.status);

        if (data.scenario) {
          addMessage({
            id: crypto.randomUUID(),
            senderType: 'BOT',
            contentType: 'TEXT',
            content: data.scenario.message,
            createdAt: new Date().toISOString(),
          });
          setOptions(data.scenario.options);
          setScenarioHistory([{ nodeId: null, options: data.scenario.options }]);
        }
      });

      socket.on(WS_EVENTS.NEW_MESSAGE, (message: Message) => {
        addMessage(message);
        if (message.senderType === 'ADMIN' || message.senderType === 'BOT') {
          const senderName = message.senderType === 'ADMIN' ? 'オペレーター' : 'サポート';
          if (!isOpenRef.current) {
            notifyNewMessage(senderName, message.content);
            setUnreadCount((prev) => prev + 1);
          } else {
            notifyNewMessage(senderName, message.content);
          }
        }
      });

      socket.on(WS_EVENTS.SCENARIO_RESPONSE, (response: { message?: string; messages?: Array<{ text: string; type: string }>; options: ScenarioOption[]; action?: string; actionValue?: string; actionConfig?: Record<string, unknown>; nodeId?: number }) => {
        if (response.messages && response.messages.length > 0) {
          const combinedText = response.messages.map(m => m.text).join('\n\n');
          addMessage({
            id: crypto.randomUUID(),
            senderType: 'BOT',
            contentType: 'TEXT',
            content: combinedText,
            createdAt: new Date().toISOString(),
          });
          notifyNewMessage('サポート', combinedText);
        } else if (response.message) {
          addMessage({
            id: crypto.randomUUID(),
            senderType: 'BOT',
            contentType: 'TEXT',
            content: response.message,
            createdAt: new Date().toISOString(),
          });
          notifyNewMessage('サポート', response.message);
        }
        setOptions(response.options);
        // 選択肢がある場合は履歴に追加（重複チェック）
        if (response.options && response.options.length > 0 && response.nodeId !== undefined) {
          const nodeIdValue = response.nodeId;
          setScenarioHistory(prev => {
            const exists = prev.some(item => item.nodeId === nodeIdValue);
            if (exists) {
              return prev;
            }
            return [...prev, { nodeId: nodeIdValue, options: response.options }];
          });
        }
        if (response.action === 'HANDOVER') {
          if (isOffHours) {
            setShowOffHoursForm(true);
            addMessage({
              id: crypto.randomUUID(),
              senderType: 'SYSTEM',
              contentType: 'TEXT',
              content: '現在は営業時間外です。お問い合わせフォームからご連絡ください。',
              createdAt: new Date().toISOString(),
            });
          } else {
            setStatus('WAITING');
          }
        } else if (response.action === 'LINK' && response.actionValue) {
          // LINKアクション: 新しいタブでURLを開く
          window.open(response.actionValue, '_blank', 'noopener,noreferrer');
        } else if (response.action === 'FORM') {
          // FORMアクション: 動的フォームを表示
          const formId = response.actionValue || 'contact';
          const formConfig = response.actionConfig as FormConfig | undefined;
          if (formConfig && formConfig.fields) {
            setDynamicFormConfig(formConfig);
          } else {
            const defaultConfig = getDefaultFormConfig(formId);
            setDynamicFormConfig(defaultConfig);
          }
          setShowDynamicForm(true);
        } else if (response.action === 'CSV') {
          // CSVアクション: 会話履歴をCSV出力
          const csvConfig = response.actionConfig as { type?: string } | undefined;
          if (conversationIdRef.current && socket) {
            socket.emit('export_csv', {
              conversationId: conversationIdRef.current,
              type: csvConfig?.type || 'conversation',
            });
          }
        } else if (response.action === 'MAIL') {
          // MAILアクション: シナリオからのメール送信
          const mailConfig = response.actionConfig as { to?: string; subject?: string; body?: string } | undefined;
          if (conversationIdRef.current && socket && mailConfig) {
            socket.emit('send_scenario_mail', {
              conversationId: conversationIdRef.current,
              config: {
                to: mailConfig.to,
                subject: mailConfig.subject || 'チャットボットからの通知',
                body: mailConfig.body || '',
              },
            });
          }
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
        } else if (data.status === 'CLOSED' && !surveyCompleted) {
          // チャット終了時に満足度アンケートを表示
          setShowSurvey(true);
        }
      });

      socket.on(WS_EVENTS.TYPING_INDICATOR, (data: { isTyping: boolean; senderType?: string }) => {
        if (data.senderType !== 'USER') {
          setIsTyping(data.isTyping);
        }
      });

      socket.on(WS_EVENTS.ALL_MESSAGES_READ, (data: { conversationId: string; readBy: string }) => {
        if (data.readBy === 'ADMIN') {
          setMessages((prev) =>
            prev.map((m) =>
              m.senderType === 'USER' ? { ...m, isRead: true } : m
            )
          );
        }
      });

      // CSVエクスポート結果を受信
      socket.on('csv_export_result', (result: { success: boolean; csv?: string; filename?: string; error?: string }) => {
        if (result.success && result.csv && result.filename) {
          const blob = new Blob(['\uFEFF' + result.csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = result.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          addMessage({
            id: crypto.randomUUID(),
            senderType: 'SYSTEM',
            contentType: 'TEXT',
            content: `CSVファイル「${result.filename}」をダウンロードしました。`,
            createdAt: new Date().toISOString(),
          });
        } else {
          addMessage({
            id: crypto.randomUUID(),
            senderType: 'SYSTEM',
            contentType: 'TEXT',
            content: result.error || 'CSVエクスポートに失敗しました。',
            createdAt: new Date().toISOString(),
          });
        }
      });

      // メール送信結果を受信
      socket.on('mail_send_result', (result: { success: boolean; error?: string }) => {
        if (result.success) {
          addMessage({
            id: crypto.randomUUID(),
            senderType: 'SYSTEM',
            contentType: 'TEXT',
            content: 'メールを送信しました。',
            createdAt: new Date().toISOString(),
          });
        } else {
          addMessage({
            id: crypto.randomUUID(),
            senderType: 'SYSTEM',
            contentType: 'TEXT',
            content: result.error || 'メール送信に失敗しました。',
            createdAt: new Date().toISOString(),
          });
        }
      });
    }
  };

  // ローディング中の表示
  const renderLoadingState = () => (
    <div class="widget-window">
      <ChatHeader status={status} onClose={() => setIsOpen(false)} appearance={appearance} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ color: '#6b7280' }}>読み込み中...</span>
      </div>
    </div>
  );

  // 時間外フォーム表示（オペレーター接続要求時）
  const renderOffHoursContent = () => (
    <div class="widget-window">
      <ChatHeader status={status} onClose={handleCloseOffHours} appearance={appearance} />
      {offHoursFormSubmitted ? (
        <OffHoursSuccessMessage
          onClose={handleCloseOffHours}
          email={offHoursSubmittedData?.email}
          name={offHoursSubmittedData?.name}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb' }}>
            <button
              onClick={handleBackToChat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '4px 0',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              チャットに戻る
            </button>
          </div>
          <OffHoursForm
            apiUrl={config.apiUrl || 'http://localhost:3000'}
            onClose={handleCloseOffHours}
            onSuccess={handleOffHoursSuccess}
          />
        </div>
      )}
    </div>
  );

  // 満足度アンケート表示
  const renderSurveyContent = () => (
    <div class="widget-window">
      <ChatHeader status={status} onClose={() => setIsOpen(false)} appearance={appearance} />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
        <SatisfactionSurvey
          conversationId={conversationId || ''}
          apiUrl={config.apiUrl || 'http://localhost:3000'}
          onComplete={handleSurveyComplete}
          onSkip={handleSurveySkip}
          primaryColor={appearance.primaryColor}
        />
      </div>
    </div>
  );

  // 動的フォーム表示
  const renderDynamicFormContent = () => (
    <div class="widget-window">
      <ChatHeader status={status} onClose={() => setIsOpen(false)} appearance={appearance} />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <button
            onClick={handleDynamicFormCancel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '4px 0',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            チャットに戻る
          </button>
        </div>
        {dynamicFormConfig && (
          <DynamicForm
            config={dynamicFormConfig}
            onSubmit={handleDynamicFormSubmit}
            onCancel={handleDynamicFormCancel}
            isSubmitting={isFormSubmitting}
          />
        )}
      </div>
    </div>
  );

  // 通常のチャット表示
  const renderChatContent = () => (
    <div class="widget-window">
      <ChatHeader status={status} onClose={() => setIsOpen(false)} onEndChat={handleEndChat} onNewChat={handleNewChat} appearance={appearance} />
      <ChatTimeline
        messages={messages}
        isTyping={isTyping}
        options={options}
        onOptionSelect={handleOptionSelect}
        onBack={handleGoBack}
        canGoBack={canGoBack}
        botIconUrl={appearance.botIconUrl}
        primaryColor={appearance.primaryColor}
        apiUrl={config.apiUrl || 'http://localhost:3000'}
      />
      <ChatInput
        disabled={isInputDisabled}
        placeholder={placeholder}
        onSend={handleSendMessage}
        onTyping={handleTyping}
        conversationId={conversationId}
        apiUrl={config.apiUrl}
        showAiHint={status === 'BOT' && options.length > 0 && !isOffHours}
      />
    </div>
  );

  // ロール変更時のハンドラ（チャットを再接続）
  const handleRoleChange = () => {
    // ロール変更を通知するメッセージ
    if (isOpen && socketRef.current) {
      // 現在の会話をリセットして再接続を促す
      addMessage({
        id: crypto.randomUUID(),
        senderType: 'SYSTEM',
        contentType: 'TEXT',
        content: 'ロールが変更されました。「新しいチャット」ボタンで再接続してください。',
        createdAt: new Date().toISOString(),
      });
    }
  };

  return (
    <>
      {isOpen ? (
        checkingBusinessHours ? renderLoadingState() :
        showSurvey ? renderSurveyContent() :
        showOffHoursForm ? renderOffHoursContent() :
        showDynamicForm ? renderDynamicFormContent() :
        renderChatContent()
      ) : null}
      <ChatLauncher
        onClick={() => setIsOpen(!isOpen)}
        isOpen={isOpen}
        unreadCount={unreadCount}
        botIconUrl={appearance.botIconUrl}
        primaryColor={appearance.primaryColor}
      />
      <DebugRolePanel onRoleChange={handleRoleChange} />
    </>
  );
}
