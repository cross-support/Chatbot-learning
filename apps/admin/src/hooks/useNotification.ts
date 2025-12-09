import { useCallback, useEffect, useRef, useState } from 'react';

interface NotificationSettings {
  soundEnabled: boolean;
  browserEnabled: boolean;
  volume: number;
}

interface UseNotificationReturn {
  settings: NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  notifyNewChat: (userName?: string) => void;
  notifyNewMessage: (userName?: string, message?: string) => void;
  notifyHandoverRequest: (userName?: string) => void;
  requestPermission: () => Promise<boolean>;
  permissionStatus: NotificationPermission | 'default';
  playTestSound: () => void;
}

const STORAGE_KEY = 'crossbot_notification_settings';

const defaultSettings: NotificationSettings = {
  soundEnabled: true,
  browserEnabled: true,
  volume: 0.7,
};

// AudioContextをグローバルに保持してユーザーインタラクション後に再利用
let globalAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return globalAudioContext;
}

// 通知音を再生する関数
async function playNotificationSound(type: 'newChat' | 'newMessage', volume: number = 0.7): Promise<void> {
  try {
    const audioContext = getAudioContext();

    // AudioContextがsuspendedの場合はresumeする
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const currentTime = audioContext.currentTime;

    if (type === 'newChat') {
      // 新規チャット用 - 2回のビープ音（より目立つ音）
      const frequencies = [880, 1100]; // A5, C#6
      frequencies.forEach((freq, index) => {
        const delay = index * 0.2;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(volume, currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + delay + 0.15);

        oscillator.start(currentTime + delay);
        oscillator.stop(currentTime + delay + 0.15);
      });
    } else {
      // 新規メッセージ用 - シンプルなポップ音
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(volume * 0.8, currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.12);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + 0.12);
    }

    console.log('[useNotification] Sound played successfully:', type);
  } catch (error) {
    console.error('[useNotification] Failed to play notification sound:', error);
  }
}

export function useNotification(): UseNotificationReturn {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return defaultSettings;
  });

  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'default'>('default');
  const lastNotificationTime = useRef<number>(0);
  const settingsRef = useRef(settings);

  // settingsをrefに同期（useCallback内で最新の値を参照するため）
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // 通知権限の状態を取得
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // 設定の保存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // ユーザーインタラクションでAudioContextを初期化
  useEffect(() => {
    const initAudioContext = () => {
      try {
        getAudioContext();
        console.log('[useNotification] AudioContext initialized');
      } catch (error) {
        console.error('[useNotification] Failed to initialize AudioContext:', error);
      }
    };

    // ユーザーインタラクション時にAudioContextを初期化
    document.addEventListener('click', initAudioContext, { once: true });
    document.addEventListener('keydown', initAudioContext, { once: true });

    return () => {
      document.removeEventListener('click', initAudioContext);
      document.removeEventListener('keydown', initAudioContext);
    };
  }, []);

  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, []);

  const playSound = useCallback((type: 'newChat' | 'newMessage') => {
    const currentSettings = settingsRef.current;
    console.log('[useNotification] playSound called:', { type, soundEnabled: currentSettings.soundEnabled, volume: currentSettings.volume });

    if (!currentSettings.soundEnabled) {
      console.log('[useNotification] Sound is disabled, skipping');
      return;
    }

    // 非同期で音を再生
    playNotificationSound(type, currentSettings.volume);
  }, []);

  // テスト用の音を再生（設定画面から呼び出す用）
  const playTestSound = useCallback(() => {
    console.log('[useNotification] Playing test sound');
    playNotificationSound('newChat', settingsRef.current.volume);
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.browserEnabled) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // 連続通知を防ぐ（1秒以内は通知しない）
    const now = Date.now();
    if (now - lastNotificationTime.current < 1000) return;
    lastNotificationTime.current = now;

    try {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'crossbot-chat',
      } as NotificationOptions);

      // 5秒後に自動で閉じる
      setTimeout(() => notification.close(), 5000);

      // クリックでウィンドウにフォーカス
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.warn('Failed to show notification:', error);
    }
  }, []);

  const notifyNewChat = useCallback((userName?: string) => {
    const name = userName || '新規ユーザー';
    console.log('[useNotification] notifyNewChat called:', { name });
    playSound('newChat');
    showBrowserNotification('新しいチャットが届きました', `${name}さんからチャットが届いています`);
  }, [playSound, showBrowserNotification]);

  const notifyNewMessage = useCallback((userName?: string, message?: string) => {
    const name = userName || 'ユーザー';
    const preview = message ? (message.length > 50 ? message.slice(0, 50) + '...' : message) : '新しいメッセージ';
    console.log('[useNotification] notifyNewMessage called:', { name, preview });
    playSound('newMessage');
    showBrowserNotification(`${name}さんからメッセージ`, preview);
  }, [playSound, showBrowserNotification]);

  const notifyHandoverRequest = useCallback((userName?: string) => {
    const name = userName || 'ユーザー';
    console.log('[useNotification] notifyHandoverRequest called:', { name });
    playSound('newChat');
    showBrowserNotification('有人対応リクエスト', `${name}さんがオペレーターへの接続を希望しています`);
  }, [playSound, showBrowserNotification]);

  return {
    settings,
    updateSettings,
    notifyNewChat,
    notifyNewMessage,
    notifyHandoverRequest,
    requestPermission,
    permissionStatus,
    playTestSound,
  };
}
