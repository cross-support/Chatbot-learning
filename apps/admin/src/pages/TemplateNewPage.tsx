import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

interface TemplateCategory {
  id: string;
  name: string;
}

const defaultCategories: TemplateCategory[] = [
  { id: 'greeting', name: '挨拶' },
  { id: 'faq', name: 'よくある質問' },
  { id: 'support', name: 'サポート' },
  { id: 'closing', name: '終了時' },
  { id: 'other', name: 'その他' },
];

const placeholderVariables = [
  { name: '{{user_name}}', description: 'ユーザー名' },
  { name: '{{operator_name}}', description: 'オペレーター名' },
  { name: '{{company_name}}', description: '会社名' },
  { name: '{{current_time}}', description: '現在時刻' },
  { name: '{{current_date}}', description: '現在日付' },
];

export default function TemplateNewPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);

  const [template, setTemplate] = useState({
    name: '',
    code: '',
    content: '',
    category: 'greeting',
    isActive: true,
  });

  const handleSave = async () => {
    if (!template.name || !template.content || !template.code) {
      alert('テンプレート名、ショートカットキー、内容を入力してください');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(template),
      });

      if (res.ok) {
        alert('テンプレートを作成しました');
        navigate('/templates');
      } else {
        const error = await res.json();
        alert(error.message || '作成に失敗しました');
      }
    } catch (err) {
      console.error('Failed to create template:', err);
      alert('作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    setTemplate({
      ...template,
      content: template.content + variable,
    });
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/templates')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-800">テンプレート作成</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="col-span-2 space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">基本情報</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    テンプレート名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={template.name}
                    onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                    placeholder="例: 初回挨拶"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ショートカットキー
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">/</span>
                      <input
                        type="text"
                        value={template.code}
                        onChange={(e) => setTemplate({ ...template, code: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
                        placeholder="greeting"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      チャット入力時に /{template.code || 'ショートカット'} で挿入できます
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      カテゴリ
                    </label>
                    <select
                      value={template.category}
                      onChange={(e) => setTemplate({ ...template, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      {defaultCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">テンプレート内容</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  メッセージ内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={template.content}
                  onChange={(e) => setTemplate({ ...template, content: e.target.value })}
                  rows={8}
                  placeholder="テンプレートの内容を入力してください。&#10;変数を使用すると動的に値が挿入されます。"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {template.content.length} 文字
                </p>
              </div>

              {/* Preview */}
              {template.content && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">プレビュー</label>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="bg-white rounded-lg px-4 py-2 shadow-sm inline-block max-w-[80%]">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {template.content
                          .replace('{{user_name}}', '山田太郎')
                          .replace('{{operator_name}}', '佐藤')
                          .replace('{{company_name}}', 'サンプル株式会社')
                          .replace('{{current_time}}', '14:30')
                          .replace('{{current_date}}', '2024/01/15')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-800">有効/無効</h3>
                  <p className="text-sm text-gray-500">無効にするとテンプレート一覧に表示されなくなります</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={template.isActive}
                    onChange={(e) => setTemplate({ ...template, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-800 mb-3">変数を挿入</h3>
              <p className="text-xs text-gray-500 mb-3">
                クリックするとカーソル位置に変数が挿入されます
              </p>
              <div className="space-y-2">
                {placeholderVariables.map((variable) => (
                  <button
                    key={variable.name}
                    onClick={() => insertVariable(variable.name)}
                    className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <code className="text-sm text-primary font-mono">{variable.name}</code>
                    <p className="text-xs text-gray-500">{variable.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-2">使い方のヒント</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• ショートカットキーを設定すると、チャット中に素早く挿入できます</li>
                <li>• 変数を使用すると、ユーザー名などを動的に置換できます</li>
                <li>• カテゴリで分類すると、管理がしやすくなります</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-800 mb-2">テンプレート例</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setTemplate({
                    ...template,
                    name: '初回挨拶',
                    code: 'hello',
                    content: 'お問い合わせありがとうございます。\n{{company_name}}の{{operator_name}}と申します。\nご質問内容をお聞かせください。',
                    category: 'greeting',
                  })}
                  className="w-full text-left text-sm text-yellow-700 hover:text-yellow-900"
                >
                  → 初回挨拶テンプレート
                </button>
                <button
                  onClick={() => setTemplate({
                    ...template,
                    name: '対応完了',
                    code: 'bye',
                    content: '{{user_name}}様、この度はお問い合わせいただきありがとうございました。\n他にご不明点がございましたら、お気軽にお問い合わせください。',
                    category: 'closing',
                  })}
                  className="w-full text-left text-sm text-yellow-700 hover:text-yellow-900"
                >
                  → 対応完了テンプレート
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
