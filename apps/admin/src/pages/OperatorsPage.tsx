import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
  status: 'ONLINE' | 'BUSY' | 'AWAY' | 'OFFLINE';
  maxConcurrent: number;
  activeChats: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  ONLINE: 'bg-green-500',
  BUSY: 'bg-yellow-500',
  AWAY: 'bg-orange-500',
  OFFLINE: 'bg-gray-400',
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'スーパー管理者',
  ADMIN: '管理者',
  OPERATOR: 'オペレーター',
};

export default function OperatorsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const { token, admin: currentAdmin } = useAuthStore();

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'OPERATOR' as 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR',
    maxConcurrent: 5,
  });

  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/admins', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAdmins(data);
      }
    } catch (error) {
      console.error('Failed to fetch admins:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    const interval = setInterval(fetchAdmins, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = () => {
    setEditingAdmin(null);
    setFormData({
      email: '',
      name: '',
      password: '',
      role: 'OPERATOR',
      maxConcurrent: 5,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (admin: Admin) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      name: admin.name,
      password: '',
      role: admin.role,
      maxConcurrent: admin.maxConcurrent,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingAdmin ? `/api/admins/${editingAdmin.id}` : '/api/admins';
      const method = editingAdmin ? 'PUT' : 'POST';

      const body: Record<string, unknown> = {
        email: formData.email,
        name: formData.name,
        role: formData.role,
        maxConcurrent: formData.maxConcurrent,
      };

      if (formData.password) {
        body.password = formData.password;
      }

      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      setIsModalOpen(false);
      fetchAdmins();
    } catch (error) {
      console.error('Failed to save admin:', error);
    }
  };

  const handleStatusChange = async (adminId: string, status: string) => {
    try {
      await fetch(`/api/admins/${adminId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      fetchAdmins();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このオペレーターを削除しますか？')) return;
    try {
      await fetch(`/api/admins/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAdmins();
    } catch (error) {
      console.error('Failed to delete admin:', error);
    }
  };

  const onlineCount = admins.filter((a) => a.status === 'ONLINE' || a.status === 'BUSY').length;

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">オペレーター管理</h1>
            <p className="text-sm text-gray-500 mt-1">
              オンライン: <span className="font-bold text-green-600">{onlineCount}</span> / {admins.length}
            </p>
          </div>
          {currentAdmin?.role === 'SUPER_ADMIN' && (
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              + 新規追加
            </button>
          )}
        </div>

        {/* Main Content */}
        <div>
        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-gray-500">読み込み中...</div>
          ) : admins.length === 0 ? (
            <div className="p-8 text-center text-gray-500">オペレーターがいません</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {admins.map((admin) => (
                <div key={admin.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-xl">
                        👤
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusColors[admin.status]}`}
                      ></span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{admin.name}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {roleLabels[admin.role]}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">{admin.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-sm text-gray-500">対応中</div>
                      <div className="font-semibold">
                        {admin.activeChats || 0} / {admin.maxConcurrent}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={admin.status}
                        onChange={(e) => handleStatusChange(admin.id, e.target.value)}
                        className="px-3 py-1 border rounded-lg text-sm"
                        disabled={admin.id !== currentAdmin?.id && currentAdmin?.role !== 'SUPER_ADMIN'}
                      >
                        <option value="ONLINE">オンライン</option>
                        <option value="BUSY">対応中</option>
                        <option value="AWAY">離席中</option>
                        <option value="OFFLINE">オフライン</option>
                      </select>
                    </div>

                    {currentAdmin?.role === 'SUPER_ADMIN' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(admin)}
                          className="p-2 text-blue-500 hover:text-blue-700"
                          title="編集"
                        >
                          ✏️
                        </button>
                        {admin.id !== currentAdmin.id && (
                          <button
                            onClick={() => handleDelete(admin.id)}
                            className="p-2 text-red-500 hover:text-red-700"
                            title="削除"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="p-4 border-b">
              <h2 className="text-lg font-bold">
                {editingAdmin ? 'オペレーター編集' : '新規オペレーター'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名前
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード {editingAdmin && '（変更する場合のみ）'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required={!editingAdmin}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  役割
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR',
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="OPERATOR">オペレーター</option>
                  <option value="ADMIN">管理者</option>
                  <option value="SUPER_ADMIN">スーパー管理者</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最大同時対応数
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.maxConcurrent}
                  onChange={(e) =>
                    setFormData({ ...formData, maxConcurrent: parseInt(e.target.value) || 5 })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  {editingAdmin ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
