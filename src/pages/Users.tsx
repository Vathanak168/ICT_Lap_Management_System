import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, ShieldAlert, Trash2, Plus, Edit2, Search, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'teacher';
  name: string;
  created_at: string;
}

const UsersManagement: React.FC = () => {
  const { role, session, isLoading: authLoading, branch } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (authLoading || role !== 'admin') {
      return;
    }

    const controller = new AbortController();

    const fetchUsers = async () => {
      setLoading(true);
      setErrorMsg('');

      try {
        let query = supabase
          .from('profiles')
          .select('id, email, role, name, created_at')
          .order('created_at', { ascending: false })
          .abortSignal(controller.signal);

        // Scope to same branch so admin only sees their branch's users
        if (branch) {
          query = query.eq('branch', branch);
        }

        const { data, error } = await query;

        if (error) throw error;
        setUsers(data ?? []);
      } catch (error: any) {
        if (!controller.signal.aborted) {
          console.error('Error fetching users:', error);
          setErrorMsg(error.message || 'បរាជ័យក្នុងការទាញយកទិន្នន័យ។');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchUsers();

    return () => controller.abort();
  }, [authLoading, role, session?.user.id]);

  const filteredUsers = useMemo(() => {
    const term = searchQuery.toLowerCase();
    return users.filter(user => 
      (user.name?.toLowerCase() || '').includes(term) ||
      (user.email?.toLowerCase() || '').includes(term)
    );
  }, [users, searchQuery]);

  // Handle Authentication Redirects
  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary-text">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        កំពុងផ្ទៀងផ្ទាត់សិទ្ធិ...
      </div>
    );
  }

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const renderDate = (dateString?: string) => {
    if (!dateString) return 'មិនស្គាល់';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? 'កាលបរិច្ឆេទមិនត្រឹមត្រូវ' : d.toLocaleDateString('km-KH');
  };

  return (
    <div className="flex flex-col w-full pb-12 space-y-5">
      {/* Header Banner - Clean Ribbon */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl p-4 sm:p-5 text-white shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl shadow-2xs">
            <Users size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">គ្រប់គ្រងអ្នកប្រើប្រាស់</h1>
            <p className="text-xs text-blue-100/80">គ្រប់គ្រងគណនី និងសិទ្ធិចូលប្រើប្រាស់ប្រព័ន្ធ</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          <button 
            type="button"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-800 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
            onClick={() => alert('មុខងារនេះមិនទាន់មាននៅឡើយទេ!')}
          >
            <Plus size={16} />
            <span>បង្កើតគណនីថ្មី</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-surface rounded-2xl border border-border/80 p-4 shadow-xs flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        <div className="flex flex-col gap-1 flex-1 min-w-[240px] max-w-md">
          <label className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">ស្វែងរក</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-text" />
            <input 
              type="text"
              placeholder="ស្វែងរកតាមឈ្មោះ ឬអុីមែល..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-border rounded-xl font-medium outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div>
          <span className="inline-flex items-center text-xs font-bold text-secondary-text bg-background px-3 py-1.5 rounded-xl border border-border/60">
            សរុប {filteredUsers.length} គណនី
          </span>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-background/80 text-secondary-text sticky top-0 z-10 border-b border-border">
              <tr>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">ឈ្មោះ</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">អុីមែល</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-center">តួនាទី</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">ថ្ងៃបង្កើត</th>
                <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-secondary-text font-medium">កំពុងផ្ទុកទិន្នន័យ...</td>
                </tr>
              ) : errorMsg ? (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <p className="text-rose-500 font-medium mb-1">{errorMsg}</p>
                    <p className="text-xs text-secondary-text">សូមពិនិត្យមើលសិទ្ធិ និង Network របស់អ្នក។</p>
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-bold text-main-text">{user.name || 'មិនមានឈ្មោះ'}</td>
                    <td className="px-5 py-3.5 text-xs text-secondary-text font-mono">{user.email}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800 border border-purple-200/80' 
                          : 'bg-blue-100 text-blue-800 border border-blue-200/80'
                      }`}>
                        {user.role === 'admin' ? <ShieldAlert size={12} /> : <Shield size={12} />}
                        <span>{user.role === 'admin' ? 'Admin' : 'Teacher'}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-secondary-text font-mono">
                      {renderDate(user.created_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          className="p-1.5 text-secondary-text hover:text-primary hover:bg-surface-hover rounded-lg transition-colors cursor-pointer" 
                          title="កែប្រែ"
                          onClick={() => alert('មុខងារនេះមិនទាន់មាននៅឡើយទេ!')}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          className="p-1.5 text-secondary-text hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" 
                          title="លុប" 
                          disabled={user.id === session?.user.id}
                          onClick={() => alert('មុខងារនេះមិនទាន់មាននៅឡើយទេ!')}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-secondary-text font-medium">មិនមានទិន្នន័យទេ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersManagement;
