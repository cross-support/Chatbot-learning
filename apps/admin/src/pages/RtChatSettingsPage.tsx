import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuthStore } from '../stores/authStore';

interface TimeSlot {
  id: string;
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  slots: TimeSlot[];
}

interface Schedule {
  [key: string]: DaySchedule;
}

interface WarningRule {
  id: string;
  minutes: number;
  color: string;
}

interface AutoResponse {
  id: string;
  delaySeconds: number;
  message: string;
}

interface ChatSettingsData {
  chatStatus: string;
  schedule: Schedule;
  holidays: string[];
  notificationSetting: string;
  notificationEmails: string;
  soundNotification: string;
  autoResponses: AutoResponse[];
  warningRules: WarningRule[];
  enableSurvey: boolean;
}

export default function RtChatSettingsPage() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedApp, setSelectedApp] = useState('クロスラーニングサポート事務局');
  const [chatStatus, setChatStatus] = useState('受付中');
  const [schedule, setSchedule] = useState<Schedule>({
    mon: { enabled: true, slots: [{ id: '1', start: '09:00:00', end: '12:00:00' }, { id: '2', start: '13:00:00', end: '16:00:00' }] },
    tue: { enabled: true, slots: [{ id: '1', start: '09:00:00', end: '12:00:00' }, { id: '2', start: '13:00:00', end: '16:00:00' }] },
    wed: { enabled: true, slots: [{ id: '1', start: '09:00:00', end: '12:00:00' }, { id: '2', start: '13:00:00', end: '16:00:00' }] },
    thu: { enabled: true, slots: [{ id: '1', start: '09:00:00', end: '12:00:00' }, { id: '2', start: '13:00:00', end: '16:00:00' }] },
    fri: { enabled: true, slots: [{ id: '1', start: '09:00:00', end: '12:00:00' }, { id: '2', start: '13:00:00', end: '16:00:00' }] },
    sat: { enabled: false, slots: [] },
    sun: { enabled: false, slots: [] },
    holiday: { enabled: false, slots: [] },
  });

  const [holidays, setHolidays] = useState<string[]>(['2025-08-13', '2025-08-14', '2025-08-15']);
  const [newHoliday, setNewHoliday] = useState('');

  const [notificationSetting, setNotificationSetting] = useState('all');
  const [notificationEmails, setNotificationEmails] = useState('cross-support@crosslink.jp.net,k-morita@cross');
  const [soundNotification, setSoundNotification] = useState('all');

  const [autoResponses, setAutoResponses] = useState<AutoResponse[]>([
    { id: '1', delaySeconds: 600, message: '緊急の場合は、お手数ですが「070-3192-8742」までお電話くださいませ。' }
  ]);

  const [warningRules, setWarningRules] = useState<WarningRule[]>([
    { id: '1', minutes: 1, color: '#FEFF7F' },
    { id: '2', minutes: 3, color: '#FF350A' },
  ]);

  const [enableSurvey, setEnableSurvey] = useState(true);

  const dayLabels: Record<string, string> = {
    mon: '月',
    tue: '火',
    wed: '水',
    thu: '木',
    fri: '金',
    sat: '土',
    sun: '日',
    holiday: '祝日',
  };

  // 曜日の表示順序を定義
  const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'holiday'];

  // 設定を読み込む
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings/chat_settings', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json() as ChatSettingsData | null;
          if (data) {
            if (data.chatStatus) setChatStatus(data.chatStatus);
            if (data.schedule) setSchedule(data.schedule);
            if (data.holidays) setHolidays(data.holidays);
            if (data.notificationSetting) setNotificationSetting(data.notificationSetting);
            if (data.notificationEmails) setNotificationEmails(data.notificationEmails);
            if (data.soundNotification) setSoundNotification(data.soundNotification);
            if (data.autoResponses) setAutoResponses(data.autoResponses);
            if (data.warningRules) setWarningRules(data.warningRules);
            if (typeof data.enableSurvey === 'boolean') setEnableSurvey(data.enableSurvey);
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [token]);

  const addTimeSlot = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: [...prev[day].slots, { id: Date.now().toString(), start: '09:00:00', end: '17:00:00' }],
      },
    }));
  };

  const removeTimeSlot = (day: string, slotId: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.filter((s) => s.id !== slotId),
      },
    }));
  };

  const updateTimeSlot = (day: string, slotId: string, field: 'start' | 'end', value: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.map((s) =>
          s.id === slotId ? { ...s, [field]: value } : s
        ),
      },
    }));
  };

  const addHoliday = () => {
    if (newHoliday && !holidays.includes(newHoliday)) {
      setHolidays((prev) => [...prev, newHoliday].sort());
      setNewHoliday('');
    }
  };

  const removeHoliday = (date: string) => {
    setHolidays((prev) => prev.filter((h) => h !== date));
  };

  const addAutoResponse = () => {
    setAutoResponses((prev) => [
      ...prev,
      { id: Date.now().toString(), delaySeconds: 300, message: '' },
    ]);
  };

  const removeAutoResponse = (id: string) => {
    setAutoResponses((prev) => prev.filter((r) => r.id !== id));
  };

  const addWarningRule = () => {
    setWarningRules((prev) => [
      ...prev,
      { id: Date.now().toString(), minutes: 5, color: '#FFFF00' },
    ]);
  };

  const removeWarningRule = (id: string) => {
    setWarningRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsData: ChatSettingsData = {
        chatStatus,
        schedule,
        holidays,
        notificationSetting,
        notificationEmails,
        soundNotification,
        autoResponses,
        warningRules,
        enableSurvey,
      };

      const response = await fetch('/api/settings/chat_settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value: settingsData }),
      });

      if (response.ok) {
        alert('設定を保存しました');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* App Selector */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">有人チャット設定</label>
              <select
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium cursor-pointer"
              >
                <option value="クロスラーニングサポート事務局">クロスラーニングサポート事務局</option>
              </select>
            </div>
          </div>

          {/* Chat Status */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">チャット受付ステータス:</label>
              <select
                value={chatStatus}
                onChange={(e) => setChatStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="受付中">受付中</option>
                <option value="受付停止">受付停止</option>
              </select>
            </div>
          </div>

          {/* Schedule Settings */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">有人チャットの対応日時設定</h2>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <label className="text-sm text-gray-700 w-24 pt-2">対応可能な日時</label>
                <div className="flex-1 space-y-4">
                  {dayOrder.map((day) => {
                    const daySchedule = schedule[day];
                    return (
                    <div key={day} className="flex items-start gap-4">
                      <span className="w-12 text-sm text-gray-700 pt-2">{dayLabels[day]}:</span>
                      <div className="flex-1">
                        {daySchedule.slots.length === 0 ? (
                          <span className="text-sm text-gray-500">営業時間が設定されていません</span>
                        ) : (
                          <div className="space-y-2">
                            {daySchedule.slots.map((slot) => (
                              <div key={slot.id} className="flex items-center gap-2">
                                <input
                                  type="time"
                                  step="1"
                                  value={slot.start}
                                  onChange={(e) => updateTimeSlot(day, slot.id, 'start', e.target.value)}
                                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                                />
                                <span>〜</span>
                                <input
                                  type="time"
                                  step="1"
                                  value={slot.end}
                                  onChange={(e) => updateTimeSlot(day, slot.id, 'end', e.target.value)}
                                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                                />
                                <button
                                  onClick={() => removeTimeSlot(day, slot.id)}
                                  className="p-1 text-gray-400 hover:text-red-500"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => addTimeSlot(day)}
                          className="mt-2 px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary-hover transition-colors"
                        >
                          追加
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-start gap-4 mt-6">
                <label className="text-sm text-gray-700 w-24">対応不可能な日</label>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-700">休日:</span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="border border-gray-300 rounded p-3 bg-gray-50 min-h-[100px]">
                    {holidays.map((date) => (
                      <div key={date} className="flex items-center justify-between py-1">
                        <span className="text-sm">{date}</span>
                        <button
                          onClick={() => removeHoliday(date)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="date"
                      value={newHoliday}
                      onChange={(e) => setNewHoliday(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={addHoliday}
                      className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary-hover transition-colors"
                    >
                      追加
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">通知設定</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-700 w-48">お客様からチャットがあった時のメール通知</label>
                <select
                  value={notificationSetting}
                  onChange={(e) => setNotificationSetting(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">全てのメッセージを通知</option>
                  <option value="first">最初のメッセージのみ通知</option>
                  <option value="none">通知しない</option>
                </select>
              </div>

              <div className="flex items-start gap-4">
                <label className="text-sm text-gray-700 w-48">
                  通知先メールアドレス
                  <br />
                  <span className="text-xs text-gray-400">複数件指定する場合はカンマ区切りで入力してください</span>
                </label>
                <input
                  type="text"
                  value={notificationEmails}
                  onChange={(e) => setNotificationEmails(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-700 w-48">音で通知</label>
                <select
                  value={soundNotification}
                  onChange={(e) => setSoundNotification(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">全てのメッセージを通知</option>
                  <option value="first">最初のメッセージのみ通知</option>
                  <option value="none">通知しない</option>
                </select>
              </div>
            </div>
          </div>

          {/* Auto Response Settings */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-medium text-gray-800">自動応答設定</h2>
              <div className="relative group">
                <button className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                  オペレーターが応答しない場合に自動でメッセージを送信します。遅延秒数とメッセージを設定してください。
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {autoResponses.map((response) => (
                <div key={response.id} className="flex items-start gap-4">
                  <label className="text-sm text-gray-700 pt-2 whitespace-nowrap">
                    お客様からチャットがあった時の自動応答
                  </label>
                  <input
                    type="number"
                    value={response.delaySeconds}
                    onChange={(e) =>
                      setAutoResponses((prev) =>
                        prev.map((r) =>
                          r.id === response.id
                            ? { ...r, delaySeconds: parseInt(e.target.value) || 0 }
                            : r
                        )
                      )
                    }
                    className="w-20 px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-sm text-gray-700 pt-2">秒後</span>
                  <textarea
                    value={response.message}
                    onChange={(e) =>
                      setAutoResponses((prev) =>
                        prev.map((r) =>
                          r.id === response.id ? { ...r, message: e.target.value } : r
                        )
                      )
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                    rows={2}
                  />
                  <button
                    onClick={() => removeAutoResponse(response.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                onClick={addAutoResponse}
                className="px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary-hover transition-colors"
              >
                追加
              </button>
            </div>
          </div>

          {/* Warning Settings */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">お客様待機時間によるワーニング設定</h2>

            <div className="space-y-4">
              {warningRules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-4">
                  <label className="text-sm text-gray-700">お客様の最終発言から一定期間経過後、枠の色を変更</label>
                  <input
                    type="number"
                    value={rule.minutes}
                    onChange={(e) =>
                      setWarningRules((prev) =>
                        prev.map((r) =>
                          r.id === rule.id
                            ? { ...r, minutes: parseInt(e.target.value) || 0 }
                            : r
                        )
                      )
                    }
                    className="w-16 px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-sm text-gray-700">分後に枠色を</span>
                  <input
                    type="color"
                    value={rule.color}
                    onChange={(e) =>
                      setWarningRules((prev) =>
                        prev.map((r) =>
                          r.id === rule.id ? { ...r, color: e.target.value } : r
                        )
                      )
                    }
                    className="w-20 h-8 border border-gray-300 rounded cursor-pointer"
                  />
                  <span className="text-sm text-gray-700">に変更</span>
                  <button
                    onClick={() => removeWarningRule(rule.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                onClick={addWarningRule}
                className="px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary-hover transition-colors"
              >
                追加
              </button>
            </div>
          </div>

          {/* Survey Settings */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-medium text-gray-800">顧客満足度調査</h2>
              <div className="relative group">
                <button className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                  有人チャット終了時にお客様へ満足度調査を表示します。調査結果は統計ページで確認できます。
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-700">有人チャット終了時に満足度調査を行いますか？</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSurvey}
                  onChange={(e) => setEnableSurvey(e.target.checked)}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="text-sm text-gray-700">調査を行う</span>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-start">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '更新'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
