import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { Users as UsersIcon, Search, Edit2, Trash2, Shield, User, X } from 'lucide-react';

interface Profile {
  id: string;
  name: string;
  email: string | null;
  phone_number: string | null;
  branch: string | null;
  profile_image_url: string | null;
  role: string;
  created_at: string;
}

const Users = () => {
  const { selectedBranch } = useOutletContext<{ selectedBranch: string }>();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
    branch: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedBranch === 'None') {
      setUsers([]);
      return;
    }
    fetchUsers();
  }, [selectedBranch]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
      
      if (selectedBranch !== 'All') {
        query = query.eq('branch', selectedBranch);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`តើអ្នកពិតជាចង់លុបគណនី "${name}" មែនទេ?`)) return;
    
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      
      setUsers(users.filter(u => u.id !== id));
      alert('លុបគណនីបានជោគជ័យ!');
    } catch (error: any) {
      alert(`មានបញ្ហាក្នុងការលុប: ${error.message}`);
    }
  };

  const handleEdit = (user: Profile) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      role: user.role || 'teacher',
      branch: user.branch || 'BELTEI IS 1'
    });
    setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editForm.name,
          role: editForm.role,
          branch: editForm.branch
        })
        .eq('id', editingUser.id);
        
      if (error) throw error;
      
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...editForm } : u));
      setIsEditModalOpen(false);
    } catch (error: any) {
      alert(`មានបញ្ហាក្នុងការរក្សាទុក: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(search.toLowerCase()) || 
    (user.email && user.email.toLowerCase().includes(search.toLowerCase())) ||
    (user.branch && user.branch.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2 font-khmer flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <UsersIcon size={24} />
            </div>
            អ្នកប្រើប្រាស់
          </h1>
          <p className="text-slate-500 font-khmer text-sm">
            កំពុងបង្ហាញទិន្នន័យសម្រាប់៖ <strong className="text-blue-600">{selectedBranch === 'None' ? 'មិនទាន់ជ្រើសរើសសាខា' : (selectedBranch === 'All' ? 'គ្រប់សាខាទាំងអស់' : selectedBranch)}</strong>
          </p>
        </div>
        
        <div className="relative w-full sm:w-auto flex gap-3">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              className="w-full h-11 pl-11 pr-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer shadow-sm text-slate-700 placeholder:text-slate-400 placeholder:font-khmer"
              placeholder="ស្វែងរកឈ្មោះ ឬអុីមែល..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={selectedBranch === 'None'}
            />
          </div>
          <button 
            onClick={() => alert('ដើម្បីបន្ថែមអ្នកប្រើប្រាស់ថ្មី សូមចុះឈ្មោះ (Sign Up) ពីផ្ទាំងកម្មវិធី (App) ផ្ទាល់។ ការបន្ថែមពីទីនេះត្រូវបានបិទដោយសារប្រព័ន្ធសុវត្ថិភាព Supabase Auth។')}
            className="btn-primary flex items-center gap-2 whitespace-nowrap bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-blue-500/20 h-11 px-6 rounded-xl text-white font-semibold shadow-lg transition-all" 
            disabled={selectedBranch === 'None'}
          >
            <UsersIcon size={18} />
            <span className="hidden sm:inline font-khmer">បន្ថែមអ្នកប្រើប្រាស់</span>
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {selectedBranch === 'None' ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <UsersIcon size={48} className="text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-700 font-khmer mb-2">សូមជ្រើសរើសសាខា</h2>
            <p className="text-slate-500 font-khmer">អ្នកត្រូវជ្រើសរើសសាខាណាមួយនៅខាងលើសិន ទើបអាចមើល ឬកែប្រែទិន្នន័យអ្នកប្រើប្រាស់បាន។</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">ឈ្មោះ</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">ទំនាក់ទំនង</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">សាខា</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm">តួនាទី</th>
                  <th className="px-6 py-4 font-khmer font-semibold text-slate-600 text-sm text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-khmer">
                      កំពុងទាញយកទិន្នន័យ...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-khmer">
                      មិនមានទិន្នន័យ
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
                            {user.profile_image_url ? (
                              <img src={user.profile_image_url} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 font-bold uppercase font-khmer">
                                {user.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 font-khmer">{user.name}</p>
                            <p className="text-xs text-slate-500 font-khmer">ចូលរួម: {new Date(user.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700 font-khmer">{user.email || 'គ្មានអុីមែល'}</p>
                        <p className="text-xs text-slate-500 font-khmer">{user.phone_number || 'គ្មានលេខទូរស័ព្ទ'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold font-khmer">
                          {user.branch || 'មិនបញ្ជាក់'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border border-purple-200 font-khmer">
                            <Shield size={12} /> អ្នកគ្រប់គ្រង
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200 font-khmer">
                            <User size={12} /> គ្រូបង្រៀន
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(user)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(user.id, user.name)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 font-khmer">កែប្រែព័ត៌មាន</h2>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">ឈ្មោះ</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">តួនាទី (Role)</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                >
                  <option value="teacher">គ្រូបង្រៀន (Teacher)</option>
                  <option value="admin">អ្នកគ្រប់គ្រង (Admin)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">សាខា (Branch)</label>
                <select
                  value={editForm.branch}
                  onChange={(e) => setEditForm({...editForm, branch: e.target.value})}
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                >
                  <option value="BELTEI IS 1">BELTEI IS 1</option>
                  <option value="BELTEI IS 2">BELTEI IS 2</option>
                  <option value="BELTEI IS 3">BELTEI IS 3</option>
                  <option value="BELTEI IS 4">BELTEI IS 4</option>
                  <option value="BELTEI IS 5">BELTEI IS 5</option>
                  <option value="BELTEI IS 6">BELTEI IS 6</option>
                  <option value="BELTEI IS 7">BELTEI IS 7</option>
                  <option value="BELTEI IS 8">BELTEI IS 8</option>
                  <option value="BELTEI IS 9">BELTEI IS 9</option>
                  <option value="BELTEI IS 10">BELTEI IS 10</option>
                  <option value="BELTEI IS 11">BELTEI IS 11</option>
                  <option value="BELTEI IS 12">BELTEI IS 12</option>
                  <option value="BELTEI IS 13">BELTEI IS 13</option>
                  <option value="BELTEI IS 14">BELTEI IS 14</option>
                  <option value="BELTEI IS 15">BELTEI IS 15</option>
                  <option value="BELTEI IS 16">BELTEI IS 16</option>
                  <option value="BELTEI IS 17">BELTEI IS 17</option>
                  <option value="BELTEI IS 18">BELTEI IS 18</option>
                  <option value="BELTEI IS 19">BELTEI IS 19</option>
                  <option value="BELTEI IS 20">BELTEI IS 20</option>
                  <option value="BELTEI IS 21">BELTEI IS 21</option>
                  <option value="BELTEI IS 22">BELTEI IS 22</option>
                  <option value="BELTEI IS 23">BELTEI IS 23</option>
                  <option value="BELTEI IS 24">BELTEI IS 24</option>
                  <option value="BELTEI IS 25">BELTEI IS 25</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 font-medium font-khmer hover:bg-slate-200 rounded-xl transition-colors"
              >
                បោះបង់
              </button>
              <button 
                onClick={saveEdit}
                disabled={isSaving}
                className="px-5 py-2.5 bg-blue-600 text-white font-medium font-khmer rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
