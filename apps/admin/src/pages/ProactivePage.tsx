import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface ProactiveRule {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  message: string;
  messageType: string;
  delay: number;
  priority: number;
  isEnabled: boolean;
  showOnce: boolean;
  maxShowCount: number;
  createdAt: string;
  updatedAt: string;
}

interface RuleStats {
  shown: number;
  clicked: number;
  dismissed: number;
  converted: number;
  clickRate: number;
  conversionRate: number;
}

interface OverallStats {
  totalRules: number;
  activeRules: number;
  totalShown: number;
  totalClicked: number;
  totalConverted: number;
  overallClickRate: number;
  overallConversionRate: number;
}

const triggerTypeLabels: Record<string, string> = {
  page_view: 'ページ表示',
  time_on_page: 'ページ滞在時間',
  scroll_depth: 'スクロール深度',
  exit_intent: '離脱意図',
  custom: 'カスタムイベント',
};

export default function ProactivePage() {
  const { token } = useAuthStore();
  const [rules, setRules] = useState<ProactiveRule[]>([]);
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [selectedRule, setSelectedRule] = useState<ProactiveRule | null>(null);
  const [ruleStats, setRuleStats] = useState<RuleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<ProactiveRule> | null>(null);

  // ルール一覧を取得
  const fetchRules = async () => {
    try {
      const response = await fetch('/api/proactive/rules?includeDisabled=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    }
  };

  // 統計を取得
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/proactive/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // ルール統計を取得
  const fetchRuleStats = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/proactive/rules/${ruleId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRuleStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch rule stats:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRules(), fetchStats()]);
      setLoading(false);
    };
    loadData();
  }, [token]);

  // ルール選択
  const handleSelectRule = async (rule: ProactiveRule) => {
    setSelectedRule(rule);
    await fetchRuleStats(rule.id);
  };

  // ルール有効/無効切り替え
  const handleToggleRule = async (ruleId: string) => {
    try {
      await fetch(`/api/proactive/rules/${ruleId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  // ルール削除
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('このルールを削除しますか？')) return;
    try {
      await fetch(`/api/proactive/rules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedRule(null);
      setRuleStats(null);
      await fetchRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  // ルール保存
  const handleSaveRule = async () => {
    if (!editingRule?.name || !editingRule?.triggerType || !editingRule?.message) {
      alert('名前、トリガータイプ、メッセージは必須です');
      return;
    }

    try {
      const method = editingRule.id ? 'PUT' : 'POST';
      const url = editingRule.id
        ? `/api/proactive/rules/${editingRule.id}`
        : '/api/proactive/rules';

      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingRule),
      });

      setShowModal(false);
      setEditingRule(null);
      await fetchRules();
    } catch (error) {
      console.error('Failed to save rule:', error);
    }
  };

  // 新規ルール作成
  const handleNewRule = () => {
    setEditingRule({
      name: '',
      description: '',
      triggerType: 'page_view',
      triggerConfig: {},
      message: '',
      messageType: 'text',
      delay: 0,
      priority: 0,
      isEnabled: true,
      showOnce: true,
      maxShowCount: 1,
    });
    setShowModal(true);
  };

  // ルール編集
  const handleEditRule = (rule: ProactiveRule) => {
    setEditingRule({ ...rule });
    setShowModal(true);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">プロアクティブチャット</h1>
            <p className="text-sm text-gray-500 mt-1">訪問者に自動でメッセージを表示するルールを管理</p>
          </div>
          <button
            onClick={handleNewRule}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            新規ルール作成
          </button>
        </div>

        {/* 統計カード */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">アクティブルール</div>
              <div className="text-2xl font-bold text-primary">{stats.activeRules}/{stats.totalRules}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">総表示回数</div>
              <div className="text-2xl font-bold text-gray-800">{stats.totalShown.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">クリック率</div>
              <div className="text-2xl font-bold text-green-600">{stats.overallClickRate}%</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">コンバージョン率</div>
              <div className="text-2xl font-bold text-blue-600">{stats.overallConversionRate}%</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ルール一覧 */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-medium text-gray-800">ルール一覧</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {rules.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  ルールがありません。新規ルールを作成してください。
                </div>
              ) : (
                rules.map((rule) => (
                  <div
                    key={rule.id}
                    onClick={() => handleSelectRule(rule)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedRule?.id === rule.id ? 'bg-primary-light border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${rule.isEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="font-medium text-gray-800 truncate">{rule.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="px-2 py-0.5 bg-gray-100 rounded">
                            {triggerTypeLabels[rule.triggerType] || rule.triggerType}
                          </span>
                          <span>優先度: {rule.priority}</span>
                          {rule.delay > 0 && <span>遅延: {rule.delay}秒</span>}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">{rule.message}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleRule(rule.id);
                          }}
                          className={`p-1.5 rounded transition-colors ${
                            rule.isEnabled
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                          title={rule.isEnabled ? '無効にする' : '有効にする'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditRule(rule);
                          }}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                          title="編集"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ルール詳細 */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-medium text-gray-800">ルール詳細</h2>
            </div>
            {selectedRule ? (
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs text-gray-500">名前</label>
                  <p className="text-sm font-medium text-gray-800">{selectedRule.name}</p>
                </div>
                {selectedRule.description && (
                  <div>
                    <label className="text-xs text-gray-500">説明</label>
                    <p className="text-sm text-gray-600">{selectedRule.description}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500">トリガータイプ</label>
                  <p className="text-sm text-gray-800">
                    {triggerTypeLabels[selectedRule.triggerType] || selectedRule.triggerType}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">メッセージ</label>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{selectedRule.message}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">遅延</label>
                    <p className="text-sm text-gray-800">{selectedRule.delay}秒</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">最大表示回数</label>
                    <p className="text-sm text-gray-800">{selectedRule.maxShowCount}回</p>
                  </div>
                </div>

                {/* ルール統計 */}
                {ruleStats && (
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-800 mb-3">パフォーマンス</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded p-2">
                        <div className="text-xs text-gray-500">表示回数</div>
                        <div className="text-lg font-bold text-gray-800">{ruleStats.shown}</div>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <div className="text-xs text-gray-500">クリック</div>
                        <div className="text-lg font-bold text-green-600">{ruleStats.clicked}</div>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <div className="text-xs text-gray-500">クリック率</div>
                        <div className="text-lg font-bold text-primary">{ruleStats.clickRate}%</div>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <div className="text-xs text-gray-500">CV率</div>
                        <div className="text-lg font-bold text-blue-600">{ruleStats.conversionRate}%</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-2">
                  <button
                    onClick={() => handleEditRule(selectedRule)}
                    className="flex-1 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDeleteRule(selectedRule.id)}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                ルールを選択してください
              </div>
            )}
          </div>
        </div>

        {/* ルール編集モーダル */}
        {showModal && editingRule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-800">
                  {editingRule.id ? 'ルールを編集' : '新規ルール作成'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingRule(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名前 *</label>
                  <input
                    type="text"
                    value={editingRule.name || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    placeholder="例: 価格ページ訪問者へのご案内"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                  <input
                    type="text"
                    value={editingRule.description || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    placeholder="このルールの目的や用途"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">トリガータイプ *</label>
                    <select
                      value={editingRule.triggerType || 'page_view'}
                      onChange={(e) => setEditingRule({ ...editingRule, triggerType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      <option value="page_view">ページ表示</option>
                      <option value="time_on_page">ページ滞在時間</option>
                      <option value="scroll_depth">スクロール深度</option>
                      <option value="exit_intent">離脱意図</option>
                      <option value="custom">カスタムイベント</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">優先度</label>
                    <input
                      type="number"
                      value={editingRule.priority || 0}
                      onChange={(e) => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      min="0"
                    />
                  </div>
                </div>

                {/* トリガー設定 */}
                {editingRule.triggerType === 'page_view' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URLパターン（正規表現）</label>
                    <input
                      type="text"
                      value={(editingRule.triggerConfig as Record<string, string>)?.urlPattern || ''}
                      onChange={(e) => setEditingRule({
                        ...editingRule,
                        triggerConfig: { ...(editingRule.triggerConfig || {}), urlPattern: e.target.value },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      placeholder="例: /pricing|/plans"
                    />
                  </div>
                )}
                {editingRule.triggerType === 'time_on_page' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">滞在時間（秒）</label>
                    <input
                      type="number"
                      value={(editingRule.triggerConfig as Record<string, number>)?.seconds || 30}
                      onChange={(e) => setEditingRule({
                        ...editingRule,
                        triggerConfig: { ...(editingRule.triggerConfig || {}), seconds: parseInt(e.target.value) || 30 },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      min="1"
                    />
                  </div>
                )}
                {editingRule.triggerType === 'scroll_depth' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">スクロール深度（%）</label>
                    <input
                      type="number"
                      value={(editingRule.triggerConfig as Record<string, number>)?.percentage || 50}
                      onChange={(e) => setEditingRule({
                        ...editingRule,
                        triggerConfig: { ...(editingRule.triggerConfig || {}), percentage: parseInt(e.target.value) || 50 },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      min="1"
                      max="100"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メッセージ *</label>
                  <textarea
                    value={editingRule.message || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, message: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    rows={3}
                    placeholder="訪問者に表示するメッセージ"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">表示遅延（秒）</label>
                    <input
                      type="number"
                      value={editingRule.delay || 0}
                      onChange={(e) => setEditingRule({ ...editingRule, delay: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">最大表示回数</label>
                    <input
                      type="number"
                      value={editingRule.maxShowCount || 1}
                      onChange={(e) => setEditingRule({ ...editingRule, maxShowCount: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      min="1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingRule.isEnabled ?? true}
                      onChange={(e) => setEditingRule({ ...editingRule, isEnabled: e.target.checked })}
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700">有効</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingRule.showOnce ?? true}
                      onChange={(e) => setEditingRule({ ...editingRule, showOnce: e.target.checked })}
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700">セッション中1回のみ表示</span>
                  </label>
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingRule(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveRule}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
