import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface Template {
  id: string;
  code: string;
  name: string;
  content: string;
  category: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatePage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { token } = useAuthStore();

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates?includeInactive=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const categories = ['all', ...new Set(templates.map((t) => t.category || '未分類'))];

  const filteredTemplates =
    selectedCategory === 'all'
      ? templates
      : templates.filter((t) => (t.category || '未分類') === selectedCategory);

  const handleToggleActive = async (template: Template) => {
    try {
      await fetch(`/api/templates/${template.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !template.isActive }),
      });
      fetchTemplates();
    } catch (error) {
      console.error('Failed to toggle template:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return;
    try {
      await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    alert('コピーしました');
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">テンプレート管理</h1>
            <p className="text-sm text-gray-500 mt-1">定型文テンプレートを管理します</p>
          </div>
          <Link
            to="/templates/new"
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            + 新規作成
          </Link>
        </div>
        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {category === 'all' ? 'すべて' : category}
            </button>
          ))}
        </div>

        {/* Template List */}
        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-gray-500">読み込み中...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              テンプレートがありません
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`p-4 ${!template.isActive ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                          {template.code}
                        </span>
                        <span className="font-medium text-gray-800">
                          {template.name}
                        </span>
                        {template.category && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {template.category}
                          </span>
                        )}
                        {!template.isActive && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">
                            無効
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">
                        {template.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleCopyContent(template.content)}
                        className="p-2 text-gray-500 hover:text-gray-700"
                        title="コピー"
                      >
                        📋
                      </button>
                      <Link
                        to={`/templates/${template.id}/edit`}
                        className="p-2 text-blue-500 hover:text-blue-700"
                        title="編集"
                      >
                        ✏️
                      </Link>
                      <button
                        onClick={() => handleToggleActive(template)}
                        className={`p-2 ${template.isActive ? 'text-green-500' : 'text-gray-400'}`}
                        title={template.isActive ? '無効にする' : '有効にする'}
                      >
                        {template.isActive ? '✅' : '⬜'}
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-2 text-red-500 hover:text-red-700"
                        title="削除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
