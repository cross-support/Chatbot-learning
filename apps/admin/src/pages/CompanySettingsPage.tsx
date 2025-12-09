import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

interface CompanyInfo {
  companyName: string;
  displayName: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  logo: string;
}

interface BusinessHours {
  start: string;
  end: string;
  holidays: string[];
}

interface MailServer {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

interface IPRestriction {
  enabled: boolean;
  allowedIPs: string[];
}

type TabType = 'basic' | 'mail' | 'security';

export default function CompanySettingsPage() {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [formData, setFormData] = useState({
    companyName: '',
    displayName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    businessHours: {
      start: '09:00',
      end: '18:00',
      holidays: [] as string[],
    },
    logo: '',
  });
  const [mailServer, setMailServer] = useState<MailServer>({
    enabled: false,
    host: '',
    port: 587,
    secure: true,
    username: '',
    password: '',
    fromName: '',
    fromEmail: '',
  });
  const [ipRestriction, setIpRestriction] = useState<IPRestriction>({
    enabled: false,
    allowedIPs: [],
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingMail, setTestingMail] = useState(false);

  // 設定を読み込み
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [companyRes, hoursRes, mailRes, ipRes] = await Promise.all([
          fetch('/api/settings/company_info', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/settings/business_hours', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/settings/mail_server', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/settings/ip_restriction', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const companyInfo = (await companyRes.json()) as CompanyInfo;
        const businessHours = (await hoursRes.json()) as BusinessHours;

        setFormData({
          companyName: companyInfo.companyName || '',
          displayName: companyInfo.displayName || '',
          email: companyInfo.email || '',
          phone: companyInfo.phone || '',
          address: companyInfo.address || '',
          website: companyInfo.website || '',
          logo: companyInfo.logo || '',
          businessHours: {
            start: businessHours.start || '09:00',
            end: businessHours.end || '18:00',
            holidays: businessHours.holidays || [],
          },
        });

        if (mailRes.ok) {
          const mailData = await mailRes.json();
          if (mailData) {
            setMailServer({ ...mailServer, ...mailData });
          }
        }

        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData) {
            setIpRestriction({ ...ipRestriction, ...ipData });
          }
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
        setError('設定の読み込みに失敗しました');
      } finally {
        setInitialLoading(false);
      }
    };

    if (token) {
      fetchSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    setError(null);

    try {
      // 会社情報を保存
      await fetch('/api/settings/company_info', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          value: {
            companyName: formData.companyName,
            displayName: formData.displayName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            website: formData.website,
            logo: formData.logo,
          },
        }),
      });

      // 営業時間を保存
      await fetch('/api/settings/business_hours', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          value: {
            enabled: true,
            start: formData.businessHours.start,
            end: formData.businessHours.end,
            holidays: formData.businessHours.holidays,
          },
        }),
      });

      // メールサーバー設定を保存
      await fetch('/api/settings/mail_server', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          value: mailServer,
        }),
      });

      // IP制限設定を保存
      await fetch('/api/settings/ip_restriction', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          value: ipRestriction,
        }),
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック（2MB制限）
    if (file.size > 2 * 1024 * 1024) {
      setError('ファイルサイズは2MB以下にしてください');
      return;
    }

    // Base64に変換
    const reader = new FileReader();
    reader.onload = () => {
      setFormData({ ...formData, logo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleTestMail = async () => {
    if (!mailServer.host || !mailServer.fromEmail) {
      alert('メールサーバーの設定を入力してください');
      return;
    }

    setTestingMail(true);
    try {
      const response = await fetch('/api/notifications/test/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: formData.email }),
      });

      if (!response.ok) {
        throw new Error('テストメールの送信に失敗しました');
      }

      alert('テストメールを送信しました。受信を確認してください。');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'テストメール送信に失敗しました');
    } finally {
      setTestingMail(false);
    }
  };

  const tabs = [
    { key: 'basic' as TabType, label: '基本情報', icon: '🏢' },
    { key: 'mail' as TabType, label: 'メールサーバー', icon: '📧' },
    { key: 'security' as TabType, label: 'セキュリティ', icon: '🔒' },
  ];

  if (initialLoading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">会社情報設定</h1>
          <p className="text-sm text-gray-500 mt-1">会社の基本情報を設定します</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
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

        <form onSubmit={handleSubmit}>
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <>
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">基本情報</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  会社名
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  表示名（チャット画面）
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  電話番号
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  住所
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Webサイト
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Business Hours */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">営業時間</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  開始時間
                </label>
                <input
                  type="time"
                  value={formData.businessHours.start}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      businessHours: { ...formData.businessHours, start: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  終了時間
                </label>
                <input
                  type="time"
                  value={formData.businessHours.end}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      businessHours: { ...formData.businessHours, end: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  定休日
                </label>
                <div className="flex flex-wrap gap-2">
                  {['月', '火', '水', '木', '金', '土', '日', '祝'].map((day) => (
                    <label key={day} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.businessHours.holidays.includes(day)}
                        onChange={(e) => {
                          const holidays = e.target.checked
                            ? [...formData.businessHours.holidays, day]
                            : formData.businessHours.holidays.filter((d) => d !== day);
                          setFormData({
                            ...formData,
                            businessHours: { ...formData.businessHours, holidays },
                          });
                        }}
                        className="w-4 h-4 text-primary rounded focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">{day}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Logo */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">ロゴ設定</h2>

            <div className="flex items-start gap-6">
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                {formData.logo ? (
                  <img src={formData.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="text-center text-gray-400">
                    <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">ロゴなし</span>
                  </div>
                )}
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  画像をアップロード
                </button>
                {formData.logo && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, logo: '' })}
                    className="ml-2 px-4 py-2 text-red-600 text-sm font-medium hover:bg-red-50 rounded-lg transition-colors"
                  >
                    削除
                  </button>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  推奨サイズ: 200x200px以上<br />
                  対応形式: PNG, JPG, SVG（2MB以下）
                </p>
              </div>
            </div>
          </div>
            </>
          )}

          {/* Mail Server Tab */}
          {activeTab === 'mail' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">メールサーバー設定</h2>
                  <p className="text-sm text-gray-500">システムからのメール送信に使用するSMTPサーバーを設定します</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mailServer.enabled}
                    onChange={(e) => setMailServer({ ...mailServer, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>

              {mailServer.enabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SMTPホスト
                      </label>
                      <input
                        type="text"
                        value={mailServer.host}
                        onChange={(e) => setMailServer({ ...mailServer, host: e.target.value })}
                        placeholder="smtp.example.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ポート
                      </label>
                      <input
                        type="number"
                        value={mailServer.port}
                        onChange={(e) => setMailServer({ ...mailServer, port: Number(e.target.value) })}
                        placeholder="587"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ユーザー名
                      </label>
                      <input
                        type="text"
                        value={mailServer.username}
                        onChange={(e) => setMailServer({ ...mailServer, username: e.target.value })}
                        placeholder="username@example.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        パスワード
                      </label>
                      <input
                        type="password"
                        value={mailServer.password}
                        onChange={(e) => setMailServer({ ...mailServer, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      id="ssl"
                      checked={mailServer.secure}
                      onChange={(e) => setMailServer({ ...mailServer, secure: e.target.checked })}
                      className="w-4 h-4 text-primary rounded focus:ring-primary"
                    />
                    <label htmlFor="ssl" className="text-sm text-gray-700">SSL/TLS を使用する</label>
                  </div>

                  <hr className="my-4" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        送信者名
                      </label>
                      <input
                        type="text"
                        value={mailServer.fromName}
                        onChange={(e) => setMailServer({ ...mailServer, fromName: e.target.value })}
                        placeholder="CrossBot サポート"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        送信者メールアドレス
                      </label>
                      <input
                        type="email"
                        value={mailServer.fromEmail}
                        onChange={(e) => setMailServer({ ...mailServer, fromEmail: e.target.value })}
                        placeholder="noreply@example.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleTestMail}
                      disabled={testingMail}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      {testingMail ? 'テスト中...' : 'テストメールを送信'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">IPアドレス制限</h2>
                    <p className="text-sm text-gray-500">管理画面へのアクセスを特定のIPアドレスからのみ許可します</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ipRestriction.enabled}
                      onChange={(e) => setIpRestriction({ ...ipRestriction, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>

                {ipRestriction.enabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      許可するIPアドレス
                    </label>
                    <textarea
                      value={ipRestriction.allowedIPs.join('\n')}
                      onChange={(e) => setIpRestriction({
                        ...ipRestriction,
                        allowedIPs: e.target.value.split('\n').filter(Boolean),
                      })}
                      rows={6}
                      placeholder="192.168.1.0/24&#10;10.0.0.1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      1行につき1つのIPアドレスまたはCIDR表記を入力してください
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-800 mb-2">注意事項</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• IPアドレス制限を有効にする前に、自分のIPアドレスが許可リストに含まれていることを確認してください</li>
                  <li>• 誤った設定をすると管理画面にアクセスできなくなる可能性があります</li>
                  <li>• CIDR表記（例: 192.168.1.0/24）を使用して範囲指定も可能です</li>
                </ul>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div>
              {saved && (
                <span className="text-green-600 text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  保存しました
                </span>
              )}
              {error && (
                <span className="text-red-600 text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
