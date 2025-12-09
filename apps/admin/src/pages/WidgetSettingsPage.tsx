import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

interface WidgetConfig {
  botIconUrl: string;
  headerTitle: string;
  headerSubtitle: string;
  headerColor: string;
  headerTextColor: string;
  primaryColor: string;
}

const defaultConfig: WidgetConfig = {
  botIconUrl: '',
  headerTitle: 'クロスラーニング サポート',
  headerSubtitle: '',
  headerColor: '#F5A623',
  headerTextColor: '#FFFFFF',
  primaryColor: '#F5A623',
};

export default function WidgetSettingsPage() {
  const { token } = useAuth();
  const [config, setConfig] = useState<WidgetConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/settings/widget_config', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setConfig({ ...defaultConfig, ...data });
          }
        }
      } catch (err) {
        console.error('Failed to fetch widget config:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchConfig();
    }
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/widget_config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value: config }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: '設定を保存しました' });
      } else {
        setMessage({ type: 'error', text: '保存に失敗しました' });
      }
    } catch (err) {
      console.error('Failed to save:', err);
      setMessage({ type: 'error', text: '保存に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'ファイルサイズは2MB以下にしてください' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setConfig(prev => ({ ...prev, botIconUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

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
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ウィジェット設定</h1>
            <p className="text-sm text-gray-500 mt-1">チャットボットの外観をカスタマイズします</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {/* ボットアイコン設定 */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">ボットアイコン</h3>
            <div className="flex items-start gap-6">
              <div>
                {config.botIconUrl ? (
                  <div className="relative">
                    <img
                      src={config.botIconUrl}
                      alt="Bot Icon"
                      className="w-24 h-24 object-cover rounded-full border-2 border-gray-200"
                    />
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, botIconUrl: '' }))}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="8" width="18" height="12" rx="2" strokeWidth="1.5" />
                      <circle cx="9" cy="14" r="2" strokeWidth="1.5" />
                      <circle cx="15" cy="14" r="2" strokeWidth="1.5" />
                      <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeWidth="1.5" />
                      <path d="M12 2v2" strokeWidth="1.5" />
                    </svg>
                  </div>
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/svg+xml"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="icon-upload"
                />
                <label
                  htmlFor="icon-upload"
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm cursor-pointer hover:bg-gray-200 transition-colors inline-block"
                >
                  画像を選択
                </label>
                <p className="text-xs text-gray-500 mt-2">推奨: 200x200px以上、PNG/JPG/GIF/SVG形式</p>
                <p className="text-xs text-gray-500">最大サイズ: 2MB</p>
                <p className="text-xs text-gray-400 mt-2">※アイコンを設定しない場合はデフォルトのロボットアイコンが表示されます</p>
              </div>
            </div>
          </div>

          <hr className="my-6" />

          {/* ヘッダー設定 */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">ヘッダー設定</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">タイトル</label>
                <input
                  type="text"
                  value={config.headerTitle}
                  onChange={(e) => setConfig(prev => ({ ...prev, headerTitle: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">サブタイトル</label>
                <input
                  type="text"
                  value={config.headerSubtitle}
                  onChange={(e) => setConfig(prev => ({ ...prev, headerSubtitle: e.target.value }))}
                  placeholder="オプション"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          <hr className="my-6" />

          {/* カラー設定 */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">カラー設定</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">プライマリカラー</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">ボタン、選択肢テキスト等に使用</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ヘッダー背景色</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.headerColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, headerColor: e.target.value }))}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.headerColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, headerColor: e.target.value }))}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ヘッダー文字色</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.headerTextColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, headerTextColor: e.target.value }))}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.headerTextColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, headerTextColor: e.target.value }))}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="my-6" />

          {/* プレビュー */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">プレビュー</h3>
            <div className="bg-gray-200 rounded-lg p-6">
              <div className="flex justify-end">
                {/* ウィジェットプレビュー */}
                <div className="w-80 bg-white rounded-lg shadow-lg overflow-hidden">
                  {/* Header */}
                  <div
                    className="px-4 py-3 flex items-center gap-3"
                    style={{
                      backgroundColor: config.headerColor,
                      color: config.headerTextColor,
                    }}
                  >
                    {config.botIconUrl ? (
                      <img
                        src={config.botIconUrl}
                        alt="Bot"
                        className="w-9 h-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={config.primaryColor} strokeWidth="1.5">
                          <rect x="3" y="8" width="18" height="12" rx="2" />
                          <circle cx="9" cy="14" r="2" />
                          <circle cx="15" cy="14" r="2" />
                          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                          <path d="M12 2v2" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{config.headerTitle}</div>
                      {config.headerSubtitle && (
                        <div className="text-xs opacity-80">{config.headerSubtitle}</div>
                      )}
                    </div>
                    <button className="p-1 hover:bg-white/20 rounded">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="p-4 space-y-3 bg-gray-50 min-h-[150px]">
                    <div className="flex items-start gap-2">
                      {config.botIconUrl ? (
                        <img src={config.botIconUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={config.primaryColor} strokeWidth="1.5">
                            <rect x="3" y="8" width="18" height="12" rx="2" />
                            <circle cx="9" cy="14" r="2" />
                            <circle cx="15" cy="14" r="2" />
                            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                            <path d="M12 2v2" />
                          </svg>
                        </div>
                      )}
                      <div className="bg-gray-100 rounded-2xl rounded-bl px-4 py-2 text-sm text-gray-800 max-w-[80%]">
                        なにかご質問はありますか？
                      </div>
                    </div>

                    {/* 選択肢プレビュー */}
                    <div className="flex items-start gap-2">
                      {config.botIconUrl ? (
                        <img src={config.botIconUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={config.primaryColor} strokeWidth="1.5">
                            <rect x="3" y="8" width="18" height="12" rx="2" />
                            <circle cx="9" cy="14" r="2" />
                            <circle cx="15" cy="14" r="2" />
                            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                            <path d="M12 2v2" />
                          </svg>
                        </div>
                      )}
                      <div className="bg-gray-100 rounded-2xl rounded-bl p-3 max-w-[80%]">
                        <div className="space-y-2">
                          <button
                            className="w-full px-3 py-2 text-sm text-center bg-white border border-gray-200 rounded-lg"
                            style={{ color: config.primaryColor }}
                          >
                            セミナー情報を知りたい
                          </button>
                          <button
                            className="w-full px-3 py-2 text-sm text-center bg-white border border-gray-200 rounded-lg"
                            style={{ color: config.primaryColor }}
                          >
                            製品について知りたい
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Input */}
                  <div className="p-3 border-t border-gray-200 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="メッセージを入力..."
                      className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm outline-none"
                      readOnly
                    />
                    <button
                      className="p-2 rounded-full"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* ランチャーボタンプレビュー */}
              <div className="flex justify-end mt-4">
                <button
                  className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  {config.botIconUrl ? (
                    <img src={config.botIconUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                      <rect x="3" y="8" width="18" height="12" rx="2" />
                      <circle cx="9" cy="14" r="2" />
                      <circle cx="15" cy="14" r="2" />
                      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                      <path d="M12 2v2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
