import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useApplications } from '../hooks/useApplications';

interface LayoutProps {
  children: React.ReactNode;
  hideHeaderOnMobile?: boolean;
}

interface DropdownItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface NavDropdownProps {
  label: string;
  items: DropdownItem[];
  isActive?: boolean;
}

function NavDropdown({ label, items, isActive }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded transition-colors ${
          isActive
            ? 'text-primary'
            : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        <span>{label}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
          {items.map((item, index) => (
            item.href ? (
              <Link
                key={index}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={index}
                onClick={() => {
                  item.onClick?.();
                  setIsOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {item.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children, hideHeaderOnMobile = false }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, token, logout } = useAuthStore();
  const { applications, currentApplication, switchApplication } = useApplications();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [appSelectorOpen, setAppSelectorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingInquiryCount, setPendingInquiryCount] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const appSelectorRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (appSelectorRef.current && !appSelectorRef.current.contains(event.target as Node)) {
        setAppSelectorOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // モバイルメニューを閉じる（ページ遷移時）
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // 未対応問い合わせ件数を定期取得
  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/off-hours-inquiries/pending-count', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPendingInquiryCount(data.count || 0);
        }
      } catch (error) {
        console.error('Failed to fetch pending inquiry count:', error);
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 60000); // 1分ごとに更新
    return () => clearInterval(interval);
  }, [token]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    logout();
    navigate('/login');
  };

  const isRtChatActive = location.pathname.startsWith('/rtchat');
  const isSettingsActive = location.pathname.startsWith('/settings');

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className={`bg-white shadow-sm border-b border-gray-200 flex-shrink-0 ${hideHeaderOnMobile ? 'hidden md:block' : ''}`}>
        <div className="px-4 py-2 flex items-center justify-between">
          {/* Logo & App Selector */}
          <div className="flex items-center gap-4">
            <Link to="/rtchat" className="flex items-center gap-2" aria-label="CrossBot ホームへ">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center" aria-hidden="true">
                <span className="text-white font-bold text-sm">CB</span>
              </div>
              <span className="text-lg font-semibold text-gray-800 hidden sm:inline">CrossBot</span>
            </Link>

            {/* Application Selector - 複数アプリがある場合のみ表示 */}
            {applications.length > 1 && (
              <div className="relative" ref={appSelectorRef}>
                <button
                  onClick={() => setAppSelectorOpen(!appSelectorOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  aria-label="アプリケーション切り替え"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="max-w-[150px] truncate">{currentApplication?.name || 'アプリ選択'}</span>
                  <svg className={`w-4 h-4 transition-transform ${appSelectorOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {appSelectorOpen && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
                      アプリケーション切り替え
                    </div>
                    {applications.map((app) => (
                      <button
                        key={app.id}
                        onClick={() => {
                          switchApplication(app);
                          setAppSelectorOpen(false);
                        }}
                        className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                          currentApplication?.id === app.id
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium">{app.name}</div>
                        <div className="text-xs text-gray-500">{app.siteId}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation - Desktop */}
          <nav className="hidden lg:flex items-center gap-2" aria-label="メインナビゲーション">
            <NavDropdown
              label="シナリオ"
              isActive={location.pathname.startsWith('/scenarios') || location.pathname.startsWith('/abtests')}
              items={[
                { label: 'シナリオ一覧', href: '/scenarios' },
                { label: 'シナリオ新規作成', href: '/scenarios/new' },
                { label: 'A/Bテスト', href: '/abtests' },
              ]}
            />
            <NavDropdown
              label="有人チャット"
              isActive={isRtChatActive || location.pathname === '/proactive'}
              items={[
                { label: '有人チャット', href: '/rtchat' },
                { label: 'プロアクティブチャット', href: '/proactive' },
                { label: '時間外問い合わせ', href: '/rtchat/off-hours-inquiries' },
                { label: '設定', href: '/rtchat/settings' },
                { label: 'NGワード設定', href: '/rtchat/ng-words' },
                { label: '振分設定', href: '/rtchat/routing' },
              ]}
            />
            <NavDropdown
              label="テンプレート"
              isActive={location.pathname.startsWith('/templates')}
              items={[
                { label: 'テンプレート一覧', href: '/templates' },
                { label: 'テンプレート新規作成', href: '/templates/new' },
              ]}
            />
            <NavDropdown
              label="統計"
              isActive={location.pathname.startsWith('/statistics') || location.pathname === '/analytics'}
              items={[
                { label: '統計ダッシュボード', href: '/statistics' },
                { label: 'オペレーター統計', href: '/statistics/operators' },
                { label: 'AIインサイト分析', href: '/analytics' },
              ]}
            />
            <NavDropdown
              label="管理メニュー"
              isActive={isSettingsActive}
              items={[
                { label: '会社情報設定', href: '/settings/company' },
                { label: 'ウィジェット設定', href: '/settings/widget' },
                { label: 'パスワードポリシー', href: '/settings/password-policy' },
                { label: 'ユーザーアカウント', href: '/settings/users' },
                { label: 'アカウント作成', href: '/settings/users/new' },
                { label: '通知設定', href: '/settings/notifications' },
                { label: 'Webhook設定', href: '/settings/webhooks' },
                { label: 'API管理', href: '/settings/api-keys' },
                { label: '連携設定', href: '/settings/integrations' },
                { label: '監査ログ', href: '/settings/audit-log' },
                { label: 'IP制限', href: '/settings/ip-whitelist' },
                { label: 'FAQ管理', href: '/settings/faq' },
                { label: 'リッチメッセージ', href: '/settings/rich-messages' },
                { label: '翻訳管理', href: '/settings/translations' },
                { label: 'システム監視', href: '/monitoring' },
              ]}
            />
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
            aria-label="メニューを開く"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* User Menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notification Bell - 時間外問い合わせへのリンク */}
            <Link
              to="/rtchat/off-hours-inquiries"
              className="relative p-2 text-gray-500 hover:text-gray-700"
              title="時間外問い合わせ"
              aria-label={`時間外問い合わせ${pendingInquiryCount > 0 ? `（${pendingInquiryCount}件の未対応）` : ''}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {pendingInquiryCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-xs font-bold text-white bg-red-500 rounded-full">
                  {pendingInquiryCount > 99 ? '99+' : pendingInquiryCount}
                </span>
              )}
            </Link>

            {/* User Avatar & Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
              >
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <span className="hidden sm:inline">{admin?.email || 'ユーザー'}</span>
                <svg className={`w-4 h-4 transition-transform hidden sm:block ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                  <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    プロフィール
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div ref={mobileMenuRef} className="lg:hidden border-t border-gray-200 bg-white">
            <nav className="px-4 py-2 space-y-1">
              <div className="py-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">シナリオ</p>
                <Link to="/scenarios" className="block py-2 text-sm text-gray-700 hover:text-primary">シナリオ一覧</Link>
                <Link to="/scenarios/new" className="block py-2 text-sm text-gray-700 hover:text-primary">シナリオ新規作成</Link>
                <Link to="/abtests" className="block py-2 text-sm text-gray-700 hover:text-primary">A/Bテスト</Link>
              </div>
              <div className="py-2 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">有人チャット</p>
                <Link to="/rtchat" className="block py-2 text-sm text-gray-700 hover:text-primary">有人チャット</Link>
                <Link to="/proactive" className="block py-2 text-sm text-gray-700 hover:text-primary">プロアクティブチャット</Link>
                <Link to="/rtchat/off-hours-inquiries" className="block py-2 text-sm text-gray-700 hover:text-primary">時間外問い合わせ</Link>
                <Link to="/rtchat/settings" className="block py-2 text-sm text-gray-700 hover:text-primary">設定</Link>
              </div>
              <div className="py-2 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">テンプレート</p>
                <Link to="/templates" className="block py-2 text-sm text-gray-700 hover:text-primary">テンプレート一覧</Link>
                <Link to="/templates/new" className="block py-2 text-sm text-gray-700 hover:text-primary">テンプレート新規作成</Link>
              </div>
              <div className="py-2 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">統計</p>
                <Link to="/statistics" className="block py-2 text-sm text-gray-700 hover:text-primary">統計ダッシュボード</Link>
                <Link to="/statistics/operators" className="block py-2 text-sm text-gray-700 hover:text-primary">オペレーター統計</Link>
                <Link to="/analytics" className="block py-2 text-sm text-gray-700 hover:text-primary">AIインサイト分析</Link>
              </div>
              <div className="py-2 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">管理メニュー</p>
                <Link to="/settings/company" className="block py-2 text-sm text-gray-700 hover:text-primary">会社情報設定</Link>
                <Link to="/settings/widget" className="block py-2 text-sm text-gray-700 hover:text-primary">ウィジェット設定</Link>
                <Link to="/settings/users" className="block py-2 text-sm text-gray-700 hover:text-primary">ユーザーアカウント</Link>
                <Link to="/settings/notifications" className="block py-2 text-sm text-gray-700 hover:text-primary">通知設定</Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto" role="main" aria-label="メインコンテンツ">
        {children}
      </main>
    </div>
  );
}
