import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface Scenario {
  id: string;
  name: string;
  description?: string;
  version: number;
  isActive: boolean;
  targetRole?: string | null; // "learner", "group_admin", "global_admin" - nullは全員対象
  sourceType?: string;
  createdAt: string;
  _count?: {
    nodes: number;
  };
}

// ロール表示名のマッピング
const roleLabels: Record<string, string> = {
  learner: '受講者',
  group_admin: 'グループ管理者',
  global_admin: '全体管理者',
};

export default function ScenarioPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuthStore();

  const fetchScenarios = async () => {
    try {
      const response = await fetch('/api/scenarios/list', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setScenarios(data || []);
    } catch (error) {
      console.error('Failed to fetch scenarios:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScenarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', file);

    // Detect format from filename
    const isEva = file.name.endsWith('.json') || file.name.endsWith('.txt');
    formData.append('format', isEva ? 'eva' : 'csv');

    // Use filename as scenario name
    const scenarioName = file.name.replace(/\.[^/.]+$/, '');
    formData.append('name', scenarioName);

    try {
      const response = await fetch('/api/scenarios/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setImportResult({
          success: true,
          message: `${result.imported}件のノードをインポートしました`,
        });
        fetchScenarios();
      } else {
        setImportResult({
          success: false,
          message: result.errors?.join(', ') || 'インポートに失敗しました',
        });
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: 'インポート中にエラーが発生しました',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (scenarioId: string) => {
    if (!confirm('このシナリオを削除しますか？')) return;

    try {
      await fetch(`/api/scenarios/scenario/${scenarioId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchScenarios();
    } catch (error) {
      console.error('Failed to delete scenario:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Import Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            シナリオインポート
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            EVA JSON形式またはCSV形式のシナリオファイルをインポートできます。
          </p>

          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt,.csv"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors ${
                uploading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary-dark'
              }`}
            >
              {uploading ? 'インポート中...' : 'ファイルを選択してインポート'}
            </label>
          </div>

          {importResult && (
            <div
              className={`mt-4 p-3 rounded-lg ${
                importResult.success
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {importResult.message}
            </div>
          )}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">シナリオ管理</h1>
            <p className="text-sm text-gray-500 mt-1">チャットボットのシナリオを管理します</p>
          </div>
          <Link
            to="/scenarios/new"
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            + 新規作成
          </Link>
        </div>

        {/* Scenario List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">
              シナリオ一覧
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">読み込み中...</div>
          ) : scenarios.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              シナリオがありません
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-800">
                          {scenario.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            scenario.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {scenario.isActive ? '有効' : '無効'}
                        </span>
                        {scenario.sourceType && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                            {scenario.sourceType.toUpperCase()}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          scenario.targetRole
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {scenario.targetRole ? roleLabels[scenario.targetRole] || scenario.targetRole : '全員対象'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        ノード数: {scenario._count?.nodes || 0} | 作成日:{' '}
                        {formatDate(scenario.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/scenarios/${scenario.id}/edit`}
                        className="text-sm text-primary hover:text-primary-hover px-3 py-1"
                      >
                        編集
                      </Link>
                      <button
                        onClick={() => handleDelete(scenario.id)}
                        className="text-sm text-red-500 hover:text-red-700 px-3 py-1"
                      >
                        削除
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
