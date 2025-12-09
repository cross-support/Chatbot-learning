import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';

interface TwoFactorAuthProps {
  token: string;
}

function TwoFactorAuth({ token }: TwoFactorAuthProps) {
  const [enabled, setEnabled] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkTwoFactorStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkTwoFactorStatus = async () => {
    try {
      const response = await fetch('/api/auth/2fa/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Failed to check 2FA status:', error);
    }
  };

  const handleEnable2FA = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setQrCode(data.qrCode);
        setSecret(data.secret);
        setBackupCodes(data.backupCodes || []);
        setShowSetupModal(true);
      } else {
        alert('2要素認証のセットアップに失敗しました');
      }
    } catch (error) {
      console.error('Failed to enable 2FA:', error);
      alert('2要素認証のセットアップに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode) {
      alert('認証コードを入力してください');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: verificationCode }),
      });

      if (response.ok) {
        setEnabled(true);
        setShowSetupModal(false);
        setShowBackupCodes(true);
        setVerificationCode('');
        alert('2要素認証を有効にしました');
      } else {
        const errorData = await response.json();
        alert(errorData.message || '認証コードが正しくありません');
      }
    } catch (error) {
      console.error('Failed to verify 2FA:', error);
      alert('検証に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    const password = prompt('2要素認証を無効にするには、パスワードを入力してください:');
    if (!password) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setEnabled(false);
        alert('2要素認証を無効にしました');
      } else {
        const errorData = await response.json();
        alert(errorData.message || '2要素認証の無効化に失敗しました');
      }
    } catch (error) {
      console.error('Failed to disable 2FA:', error);
      alert('2要素認証の無効化に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    alert('バックアップコードをクリップボードにコピーしました');
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">2要素認証</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-700">
              {enabled ? '2要素認証が有効になっています' : '2要素認証はまだ設定されていません'}
            </p>
            <p className="text-sm text-gray-500">
              {enabled
                ? 'ログイン時に認証コードの入力が必要です'
                : 'セキュリティを強化するために2要素認証を有効にしてください'}
            </p>
          </div>
          {enabled ? (
            <button
              onClick={handleDisable2FA}
              disabled={loading}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              {loading ? '処理中...' : '無効にする'}
            </button>
          ) : (
            <button
              onClick={handleEnable2FA}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {loading ? '処理中...' : '設定する'}
            </button>
          )}
        </div>
      </div>

      {/* Setup Modal */}
      {showSetupModal && qrCode && secret && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">2要素認証のセットアップ</h3>
              <button
                onClick={() => {
                  setShowSetupModal(false);
                  setQrCode(null);
                  setSecret(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Google AuthenticatorやAuthyなどの認証アプリで以下のQRコードをスキャンしてください
                </p>
                <div className="flex justify-center p-4 bg-gray-50 rounded-lg">
                  <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  QRコードを読み取れない場合は、このキーを手動で入力してください:
                </p>
                <code className="block p-2 bg-gray-100 rounded text-xs text-gray-800 break-all">
                  {secret}
                </code>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  認証コード（6桁）
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-center text-2xl tracking-widest"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSetupModal(false);
                  setQrCode(null);
                  setSecret(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                キャンセル
              </button>
              <button
                onClick={handleVerify2FA}
                disabled={loading || verificationCode.length !== 6}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? '検証中...' : '検証して有効化'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Codes Modal */}
      {showBackupCodes && backupCodes.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">バックアップコード</h3>
              <button
                onClick={() => setShowBackupCodes(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  以下のバックアップコードは、認証アプリにアクセスできない場合に使用できます。
                  <strong>安全な場所に保管してください。</strong>
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, index) => (
                    <code
                      key={index}
                      className="text-sm text-gray-800 font-mono bg-white p-2 rounded border border-gray-200"
                    >
                      {code}
                    </code>
                  ))}
                </div>
              </div>

              <button
                onClick={copyBackupCodes}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                コピー
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowBackupCodes(false)}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface ProfileData {
  name: string;
  email: string;
  avatar: string;
  phone: string;
  department: string;
  position: string;
  bio: string;
  language: 'ja' | 'en';
  timezone: string;
  theme: 'light' | 'dark' | 'system';
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface SessionData {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  lastActiveAt: string;
  isCurrent: boolean;
}


interface SessionData {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export default function ProfilePage() {
  const { token } = useAuth();
  const { admin, updateAdmin } = useAuthStore();
  const { theme: currentTheme, setTheme: setGlobalTheme } = useTheme();
  const { locale, setLocale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile');

  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    email: '',
    avatar: '',
    phone: '',
    department: '',
    position: '',
    bio: '',
    language: 'ja',
    timezone: 'Asia/Tokyo',
    theme: 'light',
  });

  const [passwords, setPasswords] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProfile({
            name: data.name || '',
            email: data.email || '',
            avatar: data.avatar || '',
            phone: data.phone || '',
            department: data.department || '',
            position: data.position || '',
            bio: data.bio || '',
            language: data.language || 'ja',
            timezone: data.timezone || 'Asia/Tokyo',
            theme: data.theme || 'light',
          });
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        // デフォルト値を使用
        if (admin) {
          setProfile(prev => ({
            ...prev,
            name: admin.name || '',
            email: admin.email || '',
          }));
        }
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchProfile();
    }
  }, [token, admin]);

  const fetchSessions = async () => {
    if (!admin?.id) return;
    try {
      const res = await fetch(`/api/admins/${admin.id}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const currentToken = token;
        const sessionsWithCurrent = data.map((session: any) => ({
          ...session,
          isCurrent: token ? session.token === currentToken : false,
        }));
        setSessions(sessionsWithCurrent);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'security') {
      fetchSessions();
    }
  }, [activeTab, token, admin]);

  const handleTerminateSession = async (sessionId: string) => {
    if (!admin?.id || !confirm('このセッションからログアウトしますか？')) return;

    try {
      const res = await fetch(`/api/admins/${admin.id}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        alert('セッションを終了しました');
        fetchSessions();
      } else {
        alert('セッションの終了に失敗しました');
      }
    } catch (err) {
      console.error('Failed to terminate session:', err);
      alert('セッションの終了に失敗しました');
    }
  };



  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // adminのIDを使用して更新
      const adminId = admin?.id;
      if (!adminId) {
        alert('ユーザーIDが取得できません');
        setSaving(false);
        return;
      }
      const res = await fetch(`/api/admins/${adminId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      if (res.ok) {
        const data = await res.json();
        updateAdmin({ name: data.name, email: data.email });
        alert('プロフィールを更新しました');
      } else {
        alert('更新に失敗しました');
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
      alert('更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 画像サイズチェック (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('画像サイズは2MB以下にしてください');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setProfile(prev => ({ ...prev, avatar: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      alert('新しいパスワードが一致しません');
      return;
    }

    if (passwords.newPassword.length < 8) {
      alert('パスワードは8文字以上にしてください');
      return;
    }

    const adminId = admin?.id;
    if (!adminId) {
      alert('ユーザーIDが取得できません');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch(`/api/admins/${adminId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        }),
      });

      if (res.ok) {
        alert('パスワードを変更しました');
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const error = await res.json();
        alert(error.message || 'パスワード変更に失敗しました');
      }
    } catch (err) {
      console.error('Failed to change password:', err);
      alert('パスワード変更に失敗しました');
    } finally {
      setChangingPassword(false);
    }
  };

  const tabs = [
    { key: 'profile' as const, label: 'プロフィール', icon: '👤' },
    { key: 'security' as const, label: 'セキュリティ', icon: '🔒' },
    { key: 'preferences' as const, label: '設定', icon: '⚙️' },
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
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">マイプロフィール</h1>
          <p className="text-sm text-gray-500 mt-1">アカウント情報と設定を管理します</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === tab.key
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

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start gap-6 mb-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="relative">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt="Avatar"
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-md">
                      {profile.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-hover transition-colors shadow-md">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">最大2MB</p>
              </div>

              {/* Basic Info */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="03-1234-5678"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">部署</label>
                    <input
                      type="text"
                      value={profile.department}
                      onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                      placeholder="カスタマーサポート部"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">役職</label>
                <input
                  type="text"
                  value={profile.position}
                  onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                  placeholder="マネージャー"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">自己紹介</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  rows={3}
                  placeholder="チームや顧客に表示される自己紹介文"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">パスワード変更</h3>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">現在のパスワード</label>
                  <input
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
                  <input
                    type="password"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">8文字以上で入力してください</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
                  <input
                    type="password"
                    value={passwords.confirmPassword}
                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !passwords.currentPassword || !passwords.newPassword}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  {changingPassword ? '変更中...' : 'パスワードを変更'}
                </button>
              </div>
            </div>

            {token && <TwoFactorAuth token={token} />}

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">ログイン履歴</h3>
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-700">{session.deviceInfo}</div>
                      <div className="text-sm text-gray-500">{session.ipAddress}</div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {session.isCurrent ? (
                        '現在のセッション'
                      ) : (
                        <button
                          onClick={() => handleTerminateSession(session.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ログアウト
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">表示設定</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">言語</label>
                <select
                  value={locale}
                  onChange={(e) => {
                    const newLocale = e.target.value as 'ja' | 'en';
                    setProfile({ ...profile, language: newLocale });
                    setLocale(newLocale);
                  }}
                  className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">タイムゾーン</label>
                <select
                  value={profile.timezone}
                  onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                  className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  <option value="Asia/Tokyo">日本標準時 (JST)</option>
                  <option value="America/New_York">アメリカ東部時間 (EST)</option>
                  <option value="America/Los_Angeles">アメリカ太平洋時間 (PST)</option>
                  <option value="Europe/London">グリニッジ標準時 (GMT)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">テーマ</label>
                <div className="flex gap-3">
                  {[ { value: 'light', label: 'ライト', icon: '☀️' }, { value: 'dark', label: 'ダーク', icon: '🌙' }, { value: 'system', label: 'システム', icon: '💻' }, ].map((theme) => (
                    <button
                      key={theme.value}
                      onClick={() => {
                        const newTheme = theme.value as 'light' | 'dark' | 'system';
                        setProfile({ ...profile, theme: newTheme });
                        setGlobalTheme(newTheme);
                      }}
                      className={`px-4 py-3 rounded-lg border-2 transition-colors flex items-center gap-2 ${currentTheme === theme.value
                          ? 'border-primary bg-primary-light'
                          : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <span>{theme.icon}</span>
                      <span className="text-sm font-medium">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}