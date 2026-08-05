import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, ShieldAlert, Trash2, Plus, Edit2, Search } from 'lucide-react';
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
  const { role, session } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full pb-10">
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>គ្រប់គ្រងអ្នកប្រើប្រាស់ (Users Management)</span>
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-end">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[250px] max-w-md">
            <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ស្វែងរក (Search)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input 
                type="text"
                placeholder="ស្វែងរកតាមឈ្មោះ ឬអុីមែល..."
                className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-sm pl-9 pr-3 py-2 outline-none focus:border-[#2a5298] transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <button className="bg-[#48b5c9] hover:bg-[#3aa3b7] text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors border border-transparent">
            <Plus size={16} /> បង្កើតគណនីថ្មី
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>បញ្ជីគណនី (List of Accounts)</span>
          <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded">សរុប {filteredUsers.length} គណនី</span>
        </div>
        <div className="overflow-x-auto p-0">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-[#f8f9fa] text-gray-800 sticky top-0 z-10 border-b border-gray-300">
              <tr>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ឈ្មោះ</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">អុីមែល</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">តួនាទី (Role)</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ថ្ងៃបង្កើត</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-500 font-medium">កំពុងផ្ទុកទិន្នន័យ...</td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{user.name || 'មិនមានឈ្មោះ'}</td>
                    <td className="px-5 py-3 text-gray-600">{user.email}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {user.role === 'admin' ? <ShieldAlert size={14} /> : <Shield size={14} />}
                        {user.role === 'admin' ? 'Admin' : 'Teacher'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-sm">
                      {new Date(user.created_at).toLocaleDateString('km-KH')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="កែប្រែ">
                          <Edit2 size={16} />
                        </button>
                        <button className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="លុប" disabled={user.id === session?.user.id}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-500 font-medium">មិនមានទិន្នន័យទេ</td>
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
