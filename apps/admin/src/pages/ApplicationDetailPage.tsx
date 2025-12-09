import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

interface ApplicationSettings {
  id: string;
  name: string;
  description: string;
  welcomeMessage: string;
  isActive: boolean;
  // チャットウィンドウ設定
  chatWindow: {
    title: string;
    subtitle: string;
    headerColor: string;
    headerTextColor: string;
    characterImage: string;
    characterPosition: 'left' | 'right' | 'none';
    showTimestamp: boolean;
    showReadStatus: boolean;
  };
  // ボットメッセージ設定
  botMessage: {
    backgroundColor: string;
    textColor: string;
    borderRadius: number;
  };
  // ユーザーメッセージ設定
  userMessage: {
    backgroundColor: string;
    textColor: string;
    borderRadius: number;
  };
  // 入力エリア設定
  inputArea: {
    placeholder: string;
    sendButtonColor: string;
    sendButtonTextColor: string;
  };
  // 表示設定
  display: {
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    width: number;
    height: number;
    zIndex: number;
    triggerButtonColor: string;
    triggerButtonIcon: 'chat' | 'message' | 'help' | 'custom';
  };
  // アクセス制限
  accessRestriction: {
    enabled: boolean;
    allowedDomains: string[];
    allowedIPs: string[];
  };
  // 埋め込みコード
  embedCode: string;
}

const defaultSettings: ApplicationSettings = {
  id: '',
  name: '',
  description: '',
  welcomeMessage: 'こんにちは！何かお手伝いできることはありますか？',
  isActive: true,
  chatWindow: {
    title: 'チャットサポート',
    subtitle: 'お気軽にご質問ください',
    headerColor: '#4A90A4',
    headerTextColor: '#FFFFFF',
    characterImage: '',
    characterPosition: 'left',
    showTimestamp: true,
    showReadStatus: true,
  },
  botMessage: {
    backgroundColor: '#F3F4F6',
    textColor: '#374151',
    borderRadius: 12,
  },
  userMessage: {
    backgroundColor: '#4A90A4',
    textColor: '#FFFFFF',
    borderRadius: 12,
  },
  inputArea: {
    placeholder: 'メッセージを入力...',
    sendButtonColor: '#4A90A4',
    sendButtonTextColor: '#FFFFFF',
  },
  display: {
    position: 'bottom-right',
    width: 380,
    height: 520,
    zIndex: 9999,
    triggerButtonColor: '#4A90A4',
    triggerButtonIcon: 'chat',
  },
  accessRestriction: {
    enabled: false,
    allowedDomains: [],
    allowedIPs: [],
  },
  embedCode: '',
};

type TabType = 'basic' | 'appearance' | 'messages' | 'display' | 'access' | 'embed';

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [settings, setSettings] = useState<ApplicationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [showPreview, setShowPreview] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);

  useEffect(() => {
    const fetchApplication = async () => {
      try {
        const res = await fetch(`/api/settings/applications/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSettings({ ...defaultSettings, ...data });
          // 埋め込みコード生成
          generateEmbedCode(data.id || id);
        }
      } catch (err) {
        console.error('Failed to fetch application:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token && id) {
      fetchApplication();
    }
  }, [token, id]);

  const generateEmbedCode = (appId: string) => {
    const code = `<!-- CrossBot Chat Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${window.location.origin}/widget.js';
    script.setAttribute('data-app-id', '${appId}');
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`;
    setSettings(prev => ({ ...prev, embedCode: code }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/settings/applications/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        alert('保存しました');
      }
    } catch (err) {
      console.error('Failed to save:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSettings(prev => ({
        ...prev,
        chatWindow: { ...prev.chatWindow, characterImage: base64 },
      }));
    };
    reader.readAsDataURL(file);
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(settings.embedCode);
    alert('クリップボードにコピーしました');
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'basic', label: '基本設定' },
    { key: 'appearance', label: '外観' },
    { key: 'messages', label: 'メッセージ' },
    { key: 'display', label: '表示設定' },
    { key: 'access', label: 'アクセス制限' },
    { key: 'embed', label: '埋め込みコード' },
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/applications')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{settings.name || 'アプリケーション設定'}</h1>
              <p className="text-sm text-gray-500 mt-1">チャットボットの設定をカスタマイズします</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showPreview ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              プレビュー {showPreview ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Settings Panel */}
          <div className={`${showPreview ? 'w-2/3' : 'w-full'} transition-all`}>
            {/* Tabs */}
            <div className="bg-white rounded-lg border border-gray-200 mb-4">
              <div className="flex border-b border-gray-200 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.key
                        ? 'text-primary border-b-2 border-primary bg-primary-light'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {/* 基本設定 */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">アプリケーション名</label>
                    <input
                      type="text"
                      value={settings.name}
                      onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">説明</label>
                    <textarea
                      value={settings.description}
                      onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ウェルカムメッセージ</label>
                    <textarea
                      value={settings.welcomeMessage}
                      onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">有効/無効</label>
                      <p className="text-xs text-gray-500 mt-1">無効にするとチャットボットが表示されなくなります</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.isActive}
                        onChange={(e) => setSettings({ ...settings, isActive: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* 外観設定 */}
              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-800">ヘッダー設定</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">タイトル</label>
                      <input
                        type="text"
                        value={settings.chatWindow.title}
                        onChange={(e) => setSettings({
                          ...settings,
                          chatWindow: { ...settings.chatWindow, title: e.target.value },
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">サブタイトル</label>
                      <input
                        type="text"
                        value={settings.chatWindow.subtitle}
                        onChange={(e) => setSettings({
                          ...settings,
                          chatWindow: { ...settings.chatWindow, subtitle: e.target.value },
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ヘッダー背景色</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.chatWindow.headerColor}
                          onChange={(e) => setSettings({
                            ...settings,
                            chatWindow: { ...settings.chatWindow, headerColor: e.target.value },
                          })}
                          className="w-12 h-10 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={settings.chatWindow.headerColor}
                          onChange={(e) => setSettings({
                            ...settings,
                            chatWindow: { ...settings.chatWindow, headerColor: e.target.value },
                          })}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ヘッダー文字色</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.chatWindow.headerTextColor}
                          onChange={(e) => setSettings({
                            ...settings,
                            chatWindow: { ...settings.chatWindow, headerTextColor: e.target.value },
                          })}
                          className="w-12 h-10 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={settings.chatWindow.headerTextColor}
                          onChange={(e) => setSettings({
                            ...settings,
                            chatWindow: { ...settings.chatWindow, headerTextColor: e.target.value },
                          })}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="my-6" />

                  <h3 className="text-lg font-semibold text-gray-800">キャラクター設定</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">キャラクター画像</label>
                    <div className="flex items-center gap-4">
                      {settings.chatWindow.characterImage ? (
                        <div className="relative">
                          <img
                            src={settings.chatWindow.characterImage}
                            alt="Character"
                            className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            onClick={() => setSettings({
                              ...settings,
                              chatWindow: { ...settings.chatWindow, characterImage: '' },
                            })}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="character-upload"
                        />
                        <label
                          htmlFor="character-upload"
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm cursor-pointer hover:bg-gray-200 transition-colors inline-block"
                        >
                          画像を選択
                        </label>
                        <p className="text-xs text-gray-500 mt-2">推奨: 200x200px以上、PNG/JPG形式</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">キャラクター位置</label>
                    <div className="flex gap-3">
                      {(['left', 'right', 'none'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setSettings({
                            ...settings,
                            chatWindow: { ...settings.chatWindow, characterPosition: pos },
                          })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            settings.chatWindow.characterPosition === pos
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {pos === 'left' ? '左' : pos === 'right' ? '右' : 'なし'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* メッセージ設定 */}
              {activeTab === 'messages' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">ボットメッセージ</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">背景色</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={settings.botMessage.backgroundColor}
                            onChange={(e) => setSettings({
                              ...settings,
                              botMessage: { ...settings.botMessage, backgroundColor: e.target.value },
                            })}
                            className="w-12 h-10 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={settings.botMessage.backgroundColor}
                            onChange={(e) => setSettings({
                              ...settings,
                              botMessage: { ...settings.botMessage, backgroundColor: e.target.value },
                            })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">文字色</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={settings.botMessage.textColor}
                            onChange={(e) => setSettings({
                              ...settings,
                              botMessage: { ...settings.botMessage, textColor: e.target.value },
                            })}
                            className="w-12 h-10 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={settings.botMessage.textColor}
                            onChange={(e) => setSettings({
                              ...settings,
                              botMessage: { ...settings.botMessage, textColor: e.target.value },
                            })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">角丸: {settings.botMessage.borderRadius}px</label>
                      <input
                        type="range"
                        min="0"
                        max="24"
                        value={settings.botMessage.borderRadius}
                        onChange={(e) => setSettings({
                          ...settings,
                          botMessage: { ...settings.botMessage, borderRadius: Number(e.target.value) },
                        })}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <hr />

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">ユーザーメッセージ</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">背景色</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={settings.userMessage.backgroundColor}
                            onChange={(e) => setSettings({
                              ...settings,
                              userMessage: { ...settings.userMessage, backgroundColor: e.target.value },
                            })}
                            className="w-12 h-10 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={settings.userMessage.backgroundColor}
                            onChange={(e) => setSettings({
                              ...settings,
                              userMessage: { ...settings.userMessage, backgroundColor: e.target.value },
                            })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">文字色</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={settings.userMessage.textColor}
                            onChange={(e) => setSettings({
                              ...settings,
                              userMessage: { ...settings.userMessage, textColor: e.target.value },
                            })}
                            className="w-12 h-10 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={settings.userMessage.textColor}
                            onChange={(e) => setSettings({
                              ...settings,
                              userMessage: { ...settings.userMessage, textColor: e.target.value },
                            })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">角丸: {settings.userMessage.borderRadius}px</label>
                      <input
                        type="range"
                        min="0"
                        max="24"
                        value={settings.userMessage.borderRadius}
                        onChange={(e) => setSettings({
                          ...settings,
                          userMessage: { ...settings.userMessage, borderRadius: Number(e.target.value) },
                        })}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <hr />

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">入力エリア</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">プレースホルダー</label>
                      <input
                        type="text"
                        value={settings.inputArea.placeholder}
                        onChange={(e) => setSettings({
                          ...settings,
                          inputArea: { ...settings.inputArea, placeholder: e.target.value },
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">送信ボタン色</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={settings.inputArea.sendButtonColor}
                            onChange={(e) => setSettings({
                              ...settings,
                              inputArea: { ...settings.inputArea, sendButtonColor: e.target.value },
                            })}
                            className="w-12 h-10 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={settings.inputArea.sendButtonColor}
                            onChange={(e) => setSettings({
                              ...settings,
                              inputArea: { ...settings.inputArea, sendButtonColor: e.target.value },
                            })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">送信ボタン文字色</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={settings.inputArea.sendButtonTextColor}
                            onChange={(e) => setSettings({
                              ...settings,
                              inputArea: { ...settings.inputArea, sendButtonTextColor: e.target.value },
                            })}
                            className="w-12 h-10 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={settings.inputArea.sendButtonTextColor}
                            onChange={(e) => setSettings({
                              ...settings,
                              inputArea: { ...settings.inputArea, sendButtonTextColor: e.target.value },
                            })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">タイムスタンプ表示</label>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.chatWindow.showTimestamp}
                        onChange={(e) => setSettings({
                          ...settings,
                          chatWindow: { ...settings.chatWindow, showTimestamp: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* 表示設定 */}
              {activeTab === 'display' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">表示位置</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setSettings({
                            ...settings,
                            display: { ...settings.display, position: pos },
                          })}
                          className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                            settings.display.position === pos
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {pos === 'bottom-right' ? '右下' : pos === 'bottom-left' ? '左下' : pos === 'top-right' ? '右上' : '左上'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">幅: {settings.display.width}px</label>
                      <input
                        type="range"
                        min="300"
                        max="500"
                        value={settings.display.width}
                        onChange={(e) => setSettings({
                          ...settings,
                          display: { ...settings.display, width: Number(e.target.value) },
                        })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">高さ: {settings.display.height}px</label>
                      <input
                        type="range"
                        min="400"
                        max="700"
                        value={settings.display.height}
                        onChange={(e) => setSettings({
                          ...settings,
                          display: { ...settings.display, height: Number(e.target.value) },
                        })}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">トリガーボタン色</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settings.display.triggerButtonColor}
                        onChange={(e) => setSettings({
                          ...settings,
                          display: { ...settings.display, triggerButtonColor: e.target.value },
                        })}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.display.triggerButtonColor}
                        onChange={(e) => setSettings({
                          ...settings,
                          display: { ...settings.display, triggerButtonColor: e.target.value },
                        })}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">トリガーボタンアイコン</label>
                    <div className="flex gap-3">
                      {(['chat', 'message', 'help'] as const).map((icon) => (
                        <button
                          key={icon}
                          onClick={() => setSettings({
                            ...settings,
                            display: { ...settings.display, triggerButtonIcon: icon },
                          })}
                          className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                            settings.display.triggerButtonIcon === icon
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {icon === 'chat' && (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          )}
                          {icon === 'message' && (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          )}
                          {icon === 'help' && (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* アクセス制限 */}
              {activeTab === 'access' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">アクセス制限を有効にする</label>
                      <p className="text-xs text-gray-500 mt-1">特定のドメインやIPアドレスからのみアクセスを許可</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.accessRestriction.enabled}
                        onChange={(e) => setSettings({
                          ...settings,
                          accessRestriction: { ...settings.accessRestriction, enabled: e.target.checked },
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  {settings.accessRestriction.enabled && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">許可ドメイン</label>
                        <textarea
                          value={settings.accessRestriction.allowedDomains.join('\n')}
                          onChange={(e) => setSettings({
                            ...settings,
                            accessRestriction: {
                              ...settings.accessRestriction,
                              allowedDomains: e.target.value.split('\n').filter(Boolean),
                            },
                          })}
                          rows={4}
                          placeholder="example.com&#10;subdomain.example.com"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">1行につき1ドメインを入力</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">許可IPアドレス</label>
                        <textarea
                          value={settings.accessRestriction.allowedIPs.join('\n')}
                          onChange={(e) => setSettings({
                            ...settings,
                            accessRestriction: {
                              ...settings.accessRestriction,
                              allowedIPs: e.target.value.split('\n').filter(Boolean),
                            },
                          })}
                          rows={4}
                          placeholder="192.168.1.0/24&#10;10.0.0.1"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">1行につき1つのIPアドレスまたはCIDR表記を入力</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 埋め込みコード */}
              {activeTab === 'embed' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">埋め込みコード</label>
                    <p className="text-sm text-gray-500 mb-4">
                      以下のコードをWebサイトの&lt;/body&gt;タグの直前に貼り付けてください。
                    </p>
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        {settings.embedCode}
                      </pre>
                      <button
                        onClick={copyEmbedCode}
                        className="absolute top-2 right-2 px-3 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 transition-colors"
                      >
                        コピー
                      </button>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">使い方</h4>
                    <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                      <li>上記のコードをコピーします</li>
                      <li>チャットボットを表示したいWebサイトのHTMLを開きます</li>
                      <li>&lt;/body&gt;タグの直前にコードを貼り付けます</li>
                      <li>ページを更新するとチャットボットが表示されます</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          {showPreview && (
            <div className="w-1/3">
              <div className="sticky top-6">
                <div className="bg-gray-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-600 mb-3 text-center">プレビュー</div>

                  {/* Chat Window Preview */}
                  <div
                    className="bg-white rounded-lg shadow-lg overflow-hidden"
                    style={{ width: '100%', maxWidth: `${settings.display.width}px` }}
                  >
                    {/* Header */}
                    <div
                      className="px-4 py-3 flex items-center gap-3"
                      style={{
                        backgroundColor: settings.chatWindow.headerColor,
                        color: settings.chatWindow.headerTextColor,
                      }}
                    >
                      {settings.chatWindow.characterImage && settings.chatWindow.characterPosition === 'left' && (
                        <img
                          src={settings.chatWindow.characterImage}
                          alt="Character"
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-semibold">{settings.chatWindow.title}</div>
                        <div className="text-xs opacity-80">{settings.chatWindow.subtitle}</div>
                      </div>
                      {settings.chatWindow.characterImage && settings.chatWindow.characterPosition === 'right' && (
                        <img
                          src={settings.chatWindow.characterImage}
                          alt="Character"
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      )}
                      <button
                        onClick={() => setPreviewOpen(!previewOpen)}
                        className="p-1 hover:bg-white/20 rounded"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Messages */}
                    {previewOpen && (
                      <>
                        <div className="p-4 space-y-3 bg-gray-50" style={{ minHeight: '200px' }}>
                          {/* Bot Message */}
                          <div className="flex items-start gap-2">
                            {settings.chatWindow.characterImage && settings.chatWindow.characterPosition !== 'none' && (
                              <img
                                src={settings.chatWindow.characterImage}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              />
                            )}
                            <div
                              className="max-w-[80%] px-4 py-2 text-sm"
                              style={{
                                backgroundColor: settings.botMessage.backgroundColor,
                                color: settings.botMessage.textColor,
                                borderRadius: `${settings.botMessage.borderRadius}px`,
                              }}
                            >
                              {settings.welcomeMessage}
                              {settings.chatWindow.showTimestamp && (
                                <div className="text-xs opacity-60 mt-1">10:00</div>
                              )}
                            </div>
                          </div>

                          {/* User Message */}
                          <div className="flex justify-end">
                            <div
                              className="max-w-[80%] px-4 py-2 text-sm"
                              style={{
                                backgroundColor: settings.userMessage.backgroundColor,
                                color: settings.userMessage.textColor,
                                borderRadius: `${settings.userMessage.borderRadius}px`,
                              }}
                            >
                              こんにちは、質問があります
                              {settings.chatWindow.showTimestamp && (
                                <div className="text-xs opacity-60 mt-1">10:01</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Input Area */}
                        <div className="p-3 border-t border-gray-200 flex items-center gap-2">
                          <input
                            type="text"
                            placeholder={settings.inputArea.placeholder}
                            className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm outline-none"
                            readOnly
                          />
                          <button
                            className="p-2 rounded-lg"
                            style={{
                              backgroundColor: settings.inputArea.sendButtonColor,
                              color: settings.inputArea.sendButtonTextColor,
                            }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Trigger Button Preview */}
                  <div className="mt-4 flex justify-end">
                    <button
                      className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: settings.display.triggerButtonColor }}
                    >
                      {settings.display.triggerButtonIcon === 'chat' && (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      )}
                      {settings.display.triggerButtonIcon === 'message' && (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      )}
                      {settings.display.triggerButtonIcon === 'help' && (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
