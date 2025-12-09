import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface Integration {
  slack: {
    webhookUrl: string;
    enabled: boolean;
    events: string[];
  };
  teams: {
    webhookUrl: string;
    enabled: boolean;
    events: string[];
  };
}

const NOTIFICATION_EVENTS = [
  { value: 'conversation.waiting', label: '新規会話発生' },
  { value: 'conversation.assigned', label: '会話割り当て' },
  { value: 'message.received', label: 'メッセージ受信' },
  { value: 'handover.requested', label: '有人対応要求' },
  { value: 'satisfaction.low', label: '低評価受信' },
  { value: 'off_hours.inquiry', label: '時間外問い合わせ' },
];

export default function IntegrationsPage() {
  const [integration, setIntegration] = useState<Integration>({
    slack: { webhookUrl: '', enabled: false, events: [] },
    teams: { webhookUrl: '', enabled: false, events: [] },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [testingTeams, setTestingTeams] = useState(false);
  const { token } = useAuthStore();

  const fetchIntegration = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/integrations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setIntegration(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch integration:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/integrations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value: integration }),
      });

      if (response.ok) {
        alert('設定を保存しました');
      } else {
        alert('設定の保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save integration:', error);
      alert('設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSlack = async () => {
    if (!integration.slack.webhookUrl) {
      alert('Slack Webhook URLを入力してください');
      return;
    }

    setTestingSlack(true);
    try {
      const response = await fetch('/api/notifications/test/slack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ webhookUrl: integration.slack.webhookUrl }),
      });

      if (response.ok) {
        alert('Slackにテストメッセージを送信しました');
      } else {
        alert('テスト送信に失敗しました');
      }
    } catch (error) {
      console.error('Failed to test Slack:', error);
      alert('テスト送信に失敗しました');
    } finally {
      setTestingSlack(false);
    }
  };

  const handleTestTeams = async () => {
    if (!integration.teams.webhookUrl) {
      alert('Teams Webhook URLを入力してください');
      return;
    }

    setTestingTeams(true);
    try {
      // Teamsの通知テストエンドポイントが存在しない場合は直接webhookをテスト
      const response = await fetch(integration.teams.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          summary: 'テスト通知',
          themeColor: '0076D7',
          title: 'CrossBot テスト通知',
          sections: [{
            activityTitle: 'テストメッセージ',
            facts: [{ name: '送信元', value: 'CrossBot' }],
            markdown: true,
          }],
        }),
      });

      if (response.ok) {
        alert('Teamsにテストメッセージを送信しました');
      } else {
        alert('テスト送信に失敗しました');
      }
    } catch (error) {
      console.error('Failed to test Teams:', error);
      alert('テスト送信に失敗しました（CORS制限の可能性があります）');
    } finally {
      setTestingTeams(false);
    }
  };

  const toggleSlackEvent = (event: string) => {
    setIntegration((prev) => ({
      ...prev,
      slack: {
        ...prev.slack,
        events: prev.slack.events.includes(event)
          ? prev.slack.events.filter((e) => e !== event)
          : [...prev.slack.events, event],
      },
    }));
  };

  const toggleTeamsEvent = (event: string) => {
    setIntegration((prev) => ({
      ...prev,
      teams: {
        ...prev.teams,
        events: prev.teams.events.includes(event)
          ? prev.teams.events.filter((e) => e !== event)
          : [...prev.teams.events, event],
      },
    }));
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">連携設定</h1>
          <p className="text-sm text-gray-500 mt-1">Slack・Microsoft Teamsとの連携を設定します</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : (
          <div className="space-y-6">
            {/* Slack Integration */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-7 h-7 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-800">Slack</h2>
                  <p className="text-sm text-gray-500">Incoming Webhookで通知を受信</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={integration.slack.enabled}
                    onChange={(e) =>
                      setIntegration({
                        ...integration,
                        slack: { ...integration.slack, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Webhook URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={integration.slack.webhookUrl}
                      onChange={(e) =>
                        setIntegration({
                          ...integration,
                          slack: { ...integration.slack, webhookUrl: e.target.value },
                        })
                      }
                      placeholder="https://hooks.slack.com/services/..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <button
                      onClick={handleTestSlack}
                      disabled={testingSlack || !integration.slack.webhookUrl}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {testingSlack ? 'テスト中...' : 'テスト送信'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Slackの「Incoming Webhook」アプリを追加して取得したURLを入力してください
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    通知イベント
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {NOTIFICATION_EVENTS.map((event) => (
                      <label
                        key={event.value}
                        className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={integration.slack.events.includes(event.value)}
                          onChange={() => toggleSlackEvent(event.value)}
                          className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">{event.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Teams Integration */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-7 h-7 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.625 8.127h-2.997V5.13c0-.832-.674-1.506-1.506-1.506H3.506C2.674 3.624 2 4.298 2 5.13v9.018c0 .832.674 1.506 1.506 1.506h2.997v2.997c0 .832.674 1.506 1.506 1.506h12.616c.832 0 1.506-.674 1.506-1.506V9.633c0-.832-.674-1.506-1.506-1.506zm-16.113 6.018H3.506c-.418 0-.506-.088-.506-.506V5.13c0-.418.088-.506.506-.506h12.616c.418 0 .506.088.506.506v8.509H8.512c-.832 0-1.506.674-1.506 1.506v.506zm16.113 4.512c0 .418-.088.506-.506.506H7.503c-.418 0-.506-.088-.506-.506v-8.509c0-.418.088-.506.506-.506h12.616c.418 0 .506.088.506.506v8.509z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-800">Microsoft Teams</h2>
                  <p className="text-sm text-gray-500">Incoming Webhookで通知を受信</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={integration.teams.enabled}
                    onChange={(e) =>
                      setIntegration({
                        ...integration,
                        teams: { ...integration.teams, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Webhook URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={integration.teams.webhookUrl}
                      onChange={(e) =>
                        setIntegration({
                          ...integration,
                          teams: { ...integration.teams, webhookUrl: e.target.value },
                        })
                      }
                      placeholder="https://outlook.office.com/webhook/..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <button
                      onClick={handleTestTeams}
                      disabled={testingTeams || !integration.teams.webhookUrl}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {testingTeams ? 'テスト中...' : 'テスト送信'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Teamsチャンネルで「Incoming Webhook」コネクタを追加して取得したURLを入力してください
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    通知イベント
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {NOTIFICATION_EVENTS.map((event) => (
                      <label
                        key={event.value}
                        className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={integration.teams.events.includes(event.value)}
                          onChange={() => toggleTeamsEvent(event.value)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{event.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? '保存中...' : '設定を保存'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
