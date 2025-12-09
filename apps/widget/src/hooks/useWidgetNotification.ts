import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

interface NotificationSettings {
  soundEnabled: boolean;
  browserEnabled: boolean;
}

interface UseWidgetNotificationReturn {
  settings: NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  notifyNewMessage: (senderName?: string, message?: string) => void;
  requestPermission: () => Promise<boolean>;
  permissionStatus: NotificationPermission | 'default';
}

const STORAGE_KEY = 'crossbot_widget_notification_settings';

const defaultSettings: NotificationSettings = {
  soundEnabled: true,
  browserEnabled: true,
};

// 通知音を生成するための関数（Web Audio APIを使用）
function createNotificationSound(): () => void {
  return () => {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      // 1回の短いビープ音
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 660; // E5
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.08);
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  };
}

export function useWidgetNotification(): UseWidgetNotificationReturn {
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

  const playSound = useCallback(() => {
    if (!settings.soundEnabled) return;

    const playNotificationSound = createNotificationSound();
    playNotificationSound();
  }, [settings.soundEnabled]);

  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (!settings.browserEnabled) return;
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
        tag: 'crossbot-widget-chat',
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
  }, [settings.browserEnabled]);

  const notifyNewMessage = useCallback((senderName?: string, message?: string) => {
    const name = senderName || 'サポート';
    const preview = message ? (message.length > 50 ? message.slice(0, 50) + '...' : message) : '新しいメッセージが届きました';
    playSound();
    showBrowserNotification(`${name}からメッセージ`, preview);
  }, [playSound, showBrowserNotification]);

  return {
    settings,
    updateSettings,
    notifyNewMessage,
    requestPermission,
    permissionStatus,
  };
}
