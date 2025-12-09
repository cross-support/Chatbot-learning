import { useState, useEffect } from 'preact/hooks';

type UserRole = 'learner' | 'group_admin' | 'global_admin';

interface DebugRolePanelProps {
  onRoleChange: (role: UserRole) => void;
}

const roleLabels: Record<UserRole, string> = {
  learner: '受講者',
  group_admin: 'グループ管理者',
  global_admin: '全体管理者',
};

export function DebugRolePanel({ onRoleChange }: DebugRolePanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>('learner');
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    // 開発環境かどうかをチェック（localhostまたは.local）
    const hostname = window.location.hostname;
    const isDevEnv = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');
    setIsDev(isDevEnv);

    // ローカルストレージから保存されたロールを取得
    const savedRole = localStorage.getItem('crossbot_debug_role') as UserRole | null;
    if (savedRole && ['learner', 'group_admin', 'global_admin'].includes(savedRole)) {
      setCurrentRole(savedRole);
      // グローバル変数にセット
      setGlobalRole(savedRole);
    }
  }, []);

  const setGlobalRole = (role: UserRole) => {
    // グローバル変数にLMSユーザー情報をセット
    (window as unknown as Record<string, unknown>).crossLearningUser = {
      id: `debug-${role}`,
      name: `テストユーザー (${roleLabels[role]})`,
      email: `${role}@example.com`,
      role: role,
    };
  };

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem('crossbot_debug_role', role);
    setGlobalRole(role);
    onRoleChange(role);
  };

  // 開発環境でない場合は何も表示しない
  if (!isDev) {
    return null;
  }

  return (
    <div class={`debug-panel ${isMinimized ? 'debug-panel-minimized' : ''}`}>
      <div class="debug-panel-header">
        <span class="debug-panel-title">DEV: ロール切替</span>
        <button
          class="debug-panel-toggle"
          onClick={() => setIsMinimized(!isMinimized)}
          title={isMinimized ? '展開' : '最小化'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isMinimized ? (
              <polyline points="6 9 12 15 18 9" />
            ) : (
              <polyline points="18 15 12 9 6 15" />
            )}
          </svg>
        </button>
      </div>
      {!isMinimized && (
        <div class="debug-panel-content">
          {(Object.keys(roleLabels) as UserRole[]).map((role) => (
            <button
              key={role}
              class={`debug-role-btn ${currentRole === role ? 'debug-role-btn-active' : 'debug-role-btn-inactive'}`}
              onClick={() => handleRoleChange(role)}
            >
              <span class={`debug-role-indicator ${currentRole === role ? 'debug-role-indicator-active' : 'debug-role-indicator-inactive'}`} />
              {roleLabels[role]}
            </button>
          ))}
          <div style={{ marginTop: '8px', fontSize: '10px', color: '#6b7280', textAlign: 'center' }}>
            ※ロール変更後、チャットを再接続してください
          </div>
        </div>
      )}
    </div>
  );
}
