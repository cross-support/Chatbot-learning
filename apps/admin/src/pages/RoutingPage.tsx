import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

interface RoutingRule {
  id: string;
  name: string;
  condition: {
    type: 'keyword' | 'url' | 'time' | 'user_attribute';
    value: string;
  };
  assignTo: string;
  priority: number;
  isActive: boolean;
}

interface Operator {
  id: string;
  name: string;
  email: string;
  maxConcurrent: number;
  currentLoad: number;
}

export default function RoutingPage() {
  const { token } = useAuth();
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [routingMode, setRoutingMode] = useState<'round-robin' | 'least-busy' | 'manual'>('least-busy');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    conditionType: 'keyword' as 'keyword' | 'url' | 'time' | 'user_attribute',
    conditionValue: '',
    assignTo: '',
  });

  // ルーティング設定を取得
  const fetchRoutingSettings = async () => {
    try {
      const res = await fetch('/api/settings/routing', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // APIはvalueを直接返すので、dataがそのままvalue
        if (data) {
          if (data.rules) setRules(data.rules);
          if (data.mode) setRoutingMode(data.mode);
        }
      }
    } catch (err) {
      console.error('Failed to fetch routing settings:', err);
    } finally {
      setLoading(false);
    }
  };

  // オペレーター一覧を取得
  const fetchOperators = async () => {
    try {
      const res = await fetch('/api/admins', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const ops = (data.admins || data || []).map((admin: { id: string; name: string; email: string; maxConcurrent?: number }) => ({
          id: admin.id,
          name: admin.name,
          email: admin.email,
          maxConcurrent: admin.maxConcurrent || 5,
          currentLoad: 0,
        }));
        setOperators(ops);
      }
    } catch (err) {
      console.error('Failed to fetch operators:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchRoutingSettings();
      fetchOperators();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 設定を保存
  const saveSettings = async (newRules: RoutingRule[], newMode: string) => {
    setSaving(true);
    try {
      await fetch('/api/settings/routing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value: { rules: newRules, mode: newMode } }),
      });
    } catch (err) {
      console.error('Failed to save routing settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.name || !newRule.conditionValue) return;

    const rule: RoutingRule = {
      id: `rule_${Date.now()}`,
      name: newRule.name,
      condition: {
        type: newRule.conditionType,
        value: newRule.conditionValue,
      },
      assignTo: newRule.assignTo || 'auto',
      priority: rules.length + 1,
      isActive: true,
    };

    const newRules = [...rules, rule];
    setRules(newRules);
    await saveSettings(newRules, routingMode);
    setNewRule({ name: '', conditionType: 'keyword', conditionValue: '', assignTo: '' });
    setShowAddModal(false);
  };

  const handleModeChange = async (mode: typeof routingMode) => {
    setRoutingMode(mode);
    await saveSettings(rules, mode);
  };

  const getConditionLabel = (type: string) => {
    switch (type) {
      case 'keyword':
        return 'キーワード';
      case 'url':
        return 'URL';
      case 'time':
        return '時間帯';
      case 'user_attribute':
        return 'ユーザー属性';
      default:
        return type;
    }
  };

  const toggleRule = async (id: string) => {
    const newRules = rules.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r));
    setRules(newRules);
    await saveSettings(newRules, routingMode);
  };

  const deleteRule = async (id: string) => {
    if (window.confirm('このルールを削除しますか？')) {
      const newRules = rules.filter((r) => r.id !== id);
      setRules(newRules);
      await saveSettings(newRules, routingMode);
    }
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">振分設定</h1>
            <p className="text-sm text-gray-500 mt-1">チャットの自動振り分けルールを設定します</p>
          </div>
          {saving && (
            <span className="text-sm text-primary">保存中...</span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Routing Mode */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">振分モード</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'round-robin', label: 'ラウンドロビン', desc: '順番に均等振分' },
                  { value: 'least-busy', label: '最小負荷', desc: '負荷が低い人に優先' },
                  { value: 'manual', label: '手動', desc: '管理者が手動で割当' },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => handleModeChange(mode.value as typeof routingMode)}
                    disabled={saving}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      routingMode === mode.value
                        ? 'border-primary bg-primary-light'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-800">{mode.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Routing Rules */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">振分ルール</h2>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                  + ルール追加
                </button>
              </div>

              {loading ? (
                <div className="p-8 text-center text-gray-500">読み込み中...</div>
              ) : rules.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  振分ルールが設定されていません
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`px-5 py-4 flex items-center justify-between ${
                        !rule.isActive ? 'bg-gray-50 opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                          {rule.priority}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{rule.name}</div>
                          <div className="text-sm text-gray-500">
                            {getConditionLabel(rule.condition.type)}: {rule.condition.value}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">→ {rule.assignTo}</span>

                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.isActive}
                            onChange={() => toggleRule(rule.id)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                        </label>

                        <button
                          onClick={() => deleteRule(rule.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Operator Status */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-800">オペレーター状況</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {operators.map((op) => (
                  <div key={op.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">{op.name}</span>
                      <span className={`text-sm ${
                        op.currentLoad >= op.maxConcurrent ? 'text-red-500' : 'text-green-500'
                      }`}>
                        {op.currentLoad} / {op.maxConcurrent}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          op.currentLoad >= op.maxConcurrent ? 'bg-red-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(op.currentLoad / op.maxConcurrent) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-800 mb-2">振分ルールの優先順位</h3>
              <p className="text-sm text-yellow-700">
                数字が小さいほど優先度が高くなります。
                複数のルールに該当する場合、最も優先度の高いルールが適用されます。
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">振分ルール追加</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ルール名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="例: 技術サポート振分"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  条件タイプ
                </label>
                <select
                  value={newRule.conditionType}
                  onChange={(e) => setNewRule({ ...newRule, conditionType: e.target.value as typeof newRule.conditionType })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  <option value="keyword">キーワード</option>
                  <option value="url">URL</option>
                  <option value="time">時間帯</option>
                  <option value="user_attribute">ユーザー属性</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  条件値 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newRule.conditionValue}
                  onChange={(e) => setNewRule({ ...newRule, conditionValue: e.target.value })}
                  placeholder={
                    newRule.conditionType === 'keyword' ? 'カンマ区切り: エラー,バグ' :
                    newRule.conditionType === 'time' ? '例: 18:00-09:00' :
                    newRule.conditionType === 'url' ? '例: /admin' : '値を入力'
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  振分先
                </label>
                <select
                  value={newRule.assignTo}
                  onChange={(e) => setNewRule({ ...newRule, assignTo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  <option value="">自動振分</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                  <option value="auto-response">自動応答</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddRule}
                disabled={!newRule.name || !newRule.conditionValue}
                className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
