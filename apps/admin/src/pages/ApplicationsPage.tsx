import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

interface Application {
  id: string;
  name: string;
  description: string;
  welcomeMessage?: string;
  primaryColor?: string;
  isActive?: boolean;
  createdAt: string;
}

export default function ApplicationsPage() {
  const { token } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/settings/applications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const text = await res.text();
        if (text) {
          try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
              setApplications(data);
            }
          } catch {
            // JSONパースエラーの場合は空配列のまま
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchApplications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDelete = async (appId: string) => {
    if (!window.confirm('このアプリケーションを削除しますか？')) return;

    try {
      const updatedApps = applications.filter((app) => app.id !== appId);
      await fetch('/api/settings/applications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value: updatedApps }),
      });
      setApplications(updatedApps);
    } catch (err) {
      console.error('Failed to delete application:', err);
    }
  };

  if (loading) {
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
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">アプリケーション一覧</h1>
            <p className="text-sm text-gray-500 mt-1">チャットボットアプリケーションを管理します</p>
          </div>
          <Link
            to="/applications/new"
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            + 新規作成
          </Link>
        </div>

        {/* Applications Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  app.isActive !== false
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {app.isActive !== false ? '稼働中' : '停止中'}
                </span>
              </div>

              <h3 className="font-semibold text-gray-800 mb-1">{app.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{app.description}</p>

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>作成: {new Date(app.createdAt).toLocaleDateString('ja-JP')}</span>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                <Link
                  to={`/applications/${app.id}`}
                  className="flex-1 px-3 py-2 text-center text-sm text-primary bg-primary-light rounded-lg hover:bg-blue-100 transition-colors"
                >
                  詳細
                </Link>
                <Link
                  to={`/applications/${app.id}/settings`}
                  className="flex-1 px-3 py-2 text-center text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  設定
                </Link>
                <button
                  onClick={() => handleDelete(app.id)}
                  className="px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          ))}

          {/* Empty State / Add New Card */}
          <Link
            to="/applications/new"
            className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-5 hover:border-primary hover:bg-gray-50 transition-colors flex flex-col items-center justify-center min-h-[200px]"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm text-gray-500">新しいアプリケーションを作成</span>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
