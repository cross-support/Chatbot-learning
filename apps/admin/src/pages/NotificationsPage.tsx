import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

interface NotificationSettings {
  // メール通知
  email: {
    enabled: boolean;
    newConversation: boolean;
    waitingAlert: boolean;
    waitingAlertMinutes: number;
    dailySummary: boolean;
    dailySummaryTime: string;
  };
  // ブラウザ通知
  browser: {
    enabled: boolean;
    sound: boolean;
    soundType: 'default' | 'bell' | 'chime' | 'none';
    newMessage: boolean;
    newConversation: boolean;
    waitingAlert: boolean;
  };
  // Slack連携
  slack: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
    newConversation: boolean;
    waitingAlert: boolean;
    dailySummary: boolean;
  };
  // LINE連携
  line: {
    enabled: boolean;
    accessToken: string;
    newConversation: boolean;
    waitingAlert: boolean;
  };
  // Chatwork連携
  chatwork: {
    enabled: boolean;
    apiToken: string;
    roomId: string;
    newConversation: boolean;
    waitingAlert: boolean;
  };
}

const defaultSettings: NotificationSettings = {
  email: {
    enabled: true,
    newConversation: true,
    waitingAlert: true,
    waitingAlertMinutes: 5,
    dailySummary: false,
    dailySummaryTime: '09:00',
  },
  browser: {
    enabled: true,
    sound: true,
    soundType: 'default',
    newMessage: true,
    newConversation: true,
    waitingAlert: true,
  },
  slack: {
    enabled: false,
    webhookUrl: '',
    channel: '#support',
    newConversation: true,
    waitingAlert: true,
    dailySummary: false,
  },
  line: {
    enabled: false,
    accessToken: '',
    newConversation: true,
    waitingAlert: true,
  },
  chatwork: {
    enabled: false,
    apiToken: '',
    roomId: '',
    newConversation: true,
    waitingAlert: true,
  },
};

type TabType = 'email' | 'browser' | 'slack' | 'line' | 'chatwork';

export default function NotificationsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('email');
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            // dataが直接設定オブジェクトとして返ってくる
            setSettings({ ...defaultSettings, ...data });
          }
        }
      } catch (err) {
        console.error('Failed to fetch notification settings:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchSettings();
    }
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          value: settings,
        }),
      });

      if (res.ok) {
        alert('保存しました');
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Save failed:', res.status, errorData);
        alert('保存に失敗しました');
      }
    } catch (err) {
      console.error('Failed to save:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        alert('ブラウザ通知が許可されました');
      } else {
        alert('ブラウザ通知が拒否されました');
      }
    } else {
      alert('このブラウザは通知をサポートしていません');
    }
  };

  const sendTestNotification = async (type: TabType) => {
    setTestSending(true);
    try {
      if (type === 'browser') {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('CrossBot テスト通知', {
            body: 'これはテスト通知です。',
            icon: '/favicon.ico',
          });
        } else {
          alert('ブラウザ通知を許可してください');
        }
      } else if (type === 'email') {
        // メールアドレス入力を求める
        const email = prompt('テストメールの送信先アドレスを入力してください:');
        if (!email) return;

        const res = await fetch('/api/notifications/test/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ to: email }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          alert('テストメールを送信しました');
        } else {
          alert(data.message || 'テストメール送信に失敗しました');
        }
      } else if (type === 'slack') {
        const res = await fetch('/api/notifications/test/slack', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (res.ok && data.success) {
          alert('テストSlack通知を送信しました');
        } else {
          alert(data.message || 'テストSlack通知送信に失敗しました');
        }
      } else if (type === 'line') {
        const res = await fetch('/api/notifications/test/line', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (data.success) {
          alert('テストLINE通知を送信しました');
        } else {
          alert(data.message || 'LINE通知は現在未実装です');
        }
      } else if (type === 'chatwork') {
        const res = await fetch('/api/notifications/test/chatwork', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            apiToken: settings.chatwork.apiToken,
            roomId: settings.chatwork.roomId,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          alert('テストChatwork通知を送信しました');
        } else {
          alert(data.message || 'テストChatwork通知送信に失敗しました');
        }
      }
    } catch (err) {
      console.error('Test notification error:', err);
      alert('テスト通知の送信に失敗しました');
    } finally {
      setTestSending(false);
    }
  };

  const tabs = [
    { key: 'email' as TabType, label: 'メール', icon: '📧' },
    { key: 'browser' as TabType, label: 'ブラウザ', icon: '🔔' },
    { key: 'slack' as TabType, label: 'Slack', icon: '💬' },
    { key: 'line' as TabType, label: 'LINE', icon: '💚' },
    { key: 'chatwork' as TabType, label: 'Chatwork', icon: '💼' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">通知設定</h1>
            <p className="text-sm text-gray-500 mt-1">各種通知方法を設定します</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === tab.key
                    ? 'text-primary border-b-2 border-primary bg-primary-light'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {/* Email Settings */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                  <h3 className="font-semibold text-gray-800">メール通知</h3>
                  <p className="text-sm text-gray-500">メールで通知を受け取ります</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.email.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      email: { ...settings.email, enabled: e.target.checked },
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>

              {settings.email.enabled && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">新規会話開始時</div>
                      <div className="text-sm text-gray-500">新しい会話が開始されたとき</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.email.newConversation}
                        onChange={(e) => setSettings({
                          ...settings,
                          email: { ...settings.email, newConversation: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">待機アラート</div>
                      <div className="text-sm text-gray-500">
                        指定時間応答がない場合
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={settings.email.waitingAlertMinutes}
                          onChange={(e) => setSettings({
                            ...settings,
                            email: { ...settings.email, waitingAlertMinutes: Number(e.target.value) },
                          })}
                          className="w-16 mx-2 px-2 py-1 border border-gray-300 rounded text-center"
                        />
                        分後
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.email.waitingAlert}
                        onChange={(e) => setSettings({
                          ...settings,
                          email: { ...settings.email, waitingAlert: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">日次サマリー</div>
                      <div className="text-sm text-gray-500">
                        毎日
                        <input
                          type="time"
                          value={settings.email.dailySummaryTime}
                          onChange={(e) => setSettings({
                            ...settings,
                            email: { ...settings.email, dailySummaryTime: e.target.value },
                          })}
                          className="mx-2 px-2 py-1 border border-gray-300 rounded"
                        />
                        に送信
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.email.dailySummary}
                        onChange={(e) => setSettings({
                          ...settings,
                          email: { ...settings.email, dailySummary: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => sendTestNotification('email')}
                      disabled={testSending}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      テストメールを送信
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Browser Settings */}
          {activeTab === 'browser' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                  <h3 className="font-semibold text-gray-800">ブラウザ通知</h3>
                  <p className="text-sm text-gray-500">デスクトップ通知を受け取ります</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.browser.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      browser: { ...settings.browser, enabled: e.target.checked },
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>

              {settings.browser.enabled && (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-yellow-800">ブラウザの通知許可が必要です</div>
                      <div className="text-sm text-yellow-700">
                        通知を受け取るには、ブラウザの許可が必要です
                      </div>
                    </div>
                    <button
                      onClick={requestBrowserPermission}
                      className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
                    >
                      許可する
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">通知音</div>
                      <div className="text-sm text-gray-500">
                        サウンド:
                        <select
                          value={settings.browser.soundType}
                          onChange={(e) => setSettings({
                            ...settings,
                            browser: { ...settings.browser, soundType: e.target.value as NotificationSettings['browser']['soundType'] },
                          })}
                          className="ml-2 px-2 py-1 border border-gray-300 rounded"
                        >
                          <option value="default">デフォルト</option>
                          <option value="bell">ベル</option>
                          <option value="chime">チャイム</option>
                          <option value="none">なし</option>
                        </select>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.browser.sound}
                        onChange={(e) => setSettings({
                          ...settings,
                          browser: { ...settings.browser, sound: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">新着メッセージ</div>
                      <div className="text-sm text-gray-500">新しいメッセージを受信したとき</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.browser.newMessage}
                        onChange={(e) => setSettings({
                          ...settings,
                          browser: { ...settings.browser, newMessage: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">新規会話</div>
                      <div className="text-sm text-gray-500">新しい会話が開始されたとき</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.browser.newConversation}
                        onChange={(e) => setSettings({
                          ...settings,
                          browser: { ...settings.browser, newConversation: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => sendTestNotification('browser')}
                      disabled={testSending}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      テスト通知を送信
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Slack Settings */}
          {activeTab === 'slack' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                  <h3 className="font-semibold text-gray-800">Slack連携</h3>
                  <p className="text-sm text-gray-500">Slackチャンネルに通知を送信します</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.slack.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      slack: { ...settings.slack, enabled: e.target.checked },
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>

              {settings.slack.enabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
                    <input
                      type="url"
                      value={settings.slack.webhookUrl}
                      onChange={(e) => setSettings({
                        ...settings,
                        slack: { ...settings.slack, webhookUrl: e.target.value },
                      })}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Slack Appの設定からIncoming Webhookを作成してURLを取得してください
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">チャンネル</label>
                    <input
                      type="text"
                      value={settings.slack.channel}
                      onChange={(e) => setSettings({
                        ...settings,
                        slack: { ...settings.slack, channel: e.target.value },
                      })}
                      placeholder="#support"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">新規会話開始時</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.slack.newConversation}
                        onChange={(e) => setSettings({
                          ...settings,
                          slack: { ...settings.slack, newConversation: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">待機アラート</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.slack.waitingAlert}
                        onChange={(e) => setSettings({
                          ...settings,
                          slack: { ...settings.slack, waitingAlert: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => sendTestNotification('slack')}
                      disabled={testSending || !settings.slack.webhookUrl}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      テストメッセージを送信
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LINE Settings */}
          {activeTab === 'line' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                  <h3 className="font-semibold text-gray-800">LINE通知</h3>
                  <p className="text-sm text-gray-500">LINE Notifyで通知を受け取ります</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.line.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      line: { ...settings.line, enabled: e.target.checked },
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>

              {settings.line.enabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">アクセストークン</label>
                    <input
                      type="password"
                      value={settings.line.accessToken}
                      onChange={(e) => setSettings({
                        ...settings,
                        line: { ...settings.line, accessToken: e.target.value },
                      })}
                      placeholder="LINE Notifyアクセストークン"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      <a href="https://notify-bot.line.me/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        LINE Notify
                      </a>
                      からトークンを発行してください
                    </p>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">新規会話開始時</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.line.newConversation}
                        onChange={(e) => setSettings({
                          ...settings,
                          line: { ...settings.line, newConversation: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">待機アラート</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.line.waitingAlert}
                        onChange={(e) => setSettings({
                          ...settings,
                          line: { ...settings.line, waitingAlert: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => sendTestNotification('line')}
                      disabled={testSending || !settings.line.accessToken}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      テスト通知を送信
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chatwork Settings */}
          {activeTab === 'chatwork' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                  <h3 className="font-semibold text-gray-800">Chatwork連携</h3>
                  <p className="text-sm text-gray-500">Chatworkルームに通知を送信します</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.chatwork.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      chatwork: { ...settings.chatwork, enabled: e.target.checked },
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>

              {settings.chatwork.enabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">APIトークン</label>
                    <input
                      type="password"
                      value={settings.chatwork.apiToken}
                      onChange={(e) => setSettings({
                        ...settings,
                        chatwork: { ...settings.chatwork, apiToken: e.target.value },
                      })}
                      placeholder="Chatwork APIトークン"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      <a href="https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Chatwork APIトークン設定ページ
                      </a>
                      からトークンを発行してください
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ルームID</label>
                    <input
                      type="text"
                      value={settings.chatwork.roomId}
                      onChange={(e) => setSettings({
                        ...settings,
                        chatwork: { ...settings.chatwork, roomId: e.target.value },
                      })}
                      placeholder="123456789"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      通知を送信するルームのIDを入力してください（URLの #!rid から取得できます）
                    </p>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">新規会話開始時</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.chatwork.newConversation}
                        onChange={(e) => setSettings({
                          ...settings,
                          chatwork: { ...settings.chatwork, newConversation: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">待機アラート</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.chatwork.waitingAlert}
                        onChange={(e) => setSettings({
                          ...settings,
                          chatwork: { ...settings.chatwork, waitingAlert: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => sendTestNotification('chatwork')}
                      disabled={testSending || !settings.chatwork.apiToken || !settings.chatwork.roomId}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      テストメッセージを送信
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
