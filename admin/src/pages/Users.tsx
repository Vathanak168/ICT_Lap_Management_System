import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { 
  Users as UsersIcon, 
  Search, 
  Edit2, 
  Trash2, 
  Shield, 
  User, 
  X,
  Key,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileCode
} from 'lucide-react';

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

const SQL_SCRIPT_CONTENT = `-- 1. Ensure pgcrypto extension is active
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Create the admin_change_user_password function
CREATE OR REPLACE FUNCTION admin_change_user_password(target_user_id UUID, new_password TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role TEXT;
  target_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'សូមចូលគណនីជាមុនសិន.';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'មានតែ Admin ប៉ុណ្ណោះដែលអាចប្តូរពាក្យសម្ងាត់អ្នកដទៃបាន.';
  END IF;

  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៦ ខ្ទង់.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = NOW()
  WHERE id = target_user_id
  RETURNING email INTO target_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'រកមិនឃើញគណនីអ្នកប្រើប្រាស់នេះទេ.';
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'បានប្តូរពាក្យសម្ងាត់ដោយជោគជ័យ!', 'email', target_email);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION admin_change_user_password(UUID, TEXT) TO authenticated;`;

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
    branch: '',
    newPassword: ''
  });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState('');
  const [passwordModalSuccess, setPasswordModalSuccess] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isSqlCopied, setIsSqlCopied] = useState(false);

  useEffect(() => {
    if (selectedBranch === 'None') {
      setUsers([]);
      return;
    }
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      branch: user.branch || 'BELTEI IS 1',
      newPassword: ''
    });
    setShowEditPassword(false);
    setIsEditModalOpen(true);
  };

  const executePasswordUpdate = async (userId: string, newPass: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const isSelf = session?.user?.id === userId;

    if (isSelf) {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
    } else {
      const { error } = await supabase.rpc('admin_change_user_password', {
        target_user_id: userId,
        new_password: newPass
      });

      if (error) {
        if (error.code === 'PGRST202' || error.message.includes('function public.admin_change_user_password') || error.message.includes('schema cache')) {
          setIsSqlModalOpen(true);
          throw new Error('មុខងារប្តូរពាក្យសម្ងាត់អ្នកដទៃទាមទារឱ្យបញ្ចូល Script ក្នុង Supabase SQL Editor ជាមុនសិន។');
        }
        throw error;
      }
    }
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    try {
      setIsSaving(true);

      // 1. Update profile info
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editForm.name,
          role: editForm.role,
          branch: editForm.branch
        })
        .eq('id', editingUser.id);
        
      if (error) throw error;

      // 2. Update password if provided
      if (editForm.newPassword.trim()) {
        if (editForm.newPassword.trim().length < 6) {
          throw new Error('ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៦ ខ្ទង់!');
        }
        await executePasswordUpdate(editingUser.id, editForm.newPassword.trim());
      }
      
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, name: editForm.name, role: editForm.role, branch: editForm.branch } : u));
      setIsEditModalOpen(false);
      alert('កែប្រែព័ត៌មានបានជោគជ័យ!');
    } catch (error: any) {
      alert(`មានបញ្ហាក្នុងការរក្សាទុក: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPasswordModal = (user: Profile) => {
    setPasswordTargetUser(user);
    setNewPassword('');
    setPasswordModalError('');
    setPasswordModalSuccess('');
    setIsCopied(false);
    setShowNewPassword(false);
    setIsPasswordModalOpen(true);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setPasswordModalError('');
  };

  const handleCopyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCRIPT_CONTENT);
    setIsSqlCopied(true);
    setTimeout(() => setIsSqlCopied(false), 2000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser) return;
    if (!newPassword || newPassword.trim().length < 6) {
      setPasswordModalError('ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៦ ខ្ទង់');
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordModalError('');
    setPasswordModalSuccess('');

    try {
      await executePasswordUpdate(passwordTargetUser.id, newPassword.trim());
      setPasswordModalSuccess(`បានប្តូរពាក្យសម្ងាត់គណនី "${passwordTargetUser.name}" ដោយជោគជ័យ!`);
    } catch (err: any) {
      setPasswordModalError(err.message || 'មានបញ្ហាក្នុងការប្តូរពាក្យសម្ងាត់');
    } finally {
      setIsUpdatingPassword(false);
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
            onClick={() => alert('ដើម្បីបន្ថែមអ្នកប្រើប្រាស់ថ្មី សូមចុះឈ្មោះ ពីផ្ទាំងកម្មវិធី ផ្ទាល់។ ការបន្ថែមពីទីនេះត្រូវបានបិទដោយសារប្រព័ន្ធសុវត្ថិភាព Supabase Auth។')}
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
        ) : loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-khmer">កំពុងទាញយកទិន្នន័យ...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <UsersIcon size={48} className="text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700 font-khmer mb-1">រកមិនឃើញទិន្នន័យ</h3>
            <p className="text-slate-500 font-khmer text-sm">មិនមានអ្នកប្រើប្រាស់នៅក្នុងសាខា ឬត្រូវនឹងការស្វែងរកនេះឡើយ។</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4 font-khmer">អ្នកប្រើប្រាស់</th>
                  <th className="px-6 py-4 font-khmer">ទំនាក់ទំនង</th>
                  <th className="px-6 py-4 font-khmer">សាខា</th>
                  <th className="px-6 py-4 font-khmer">តួនាទី</th>
                  <th className="px-6 py-4 text-right font-khmer">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/10">
                          {user.name.charAt(0).toUpperCase()}
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
                      <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenPasswordModal(user)}
                          className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-200"
                          title="ប្តូរពាក្យសម្ងាត់"
                        >
                          <Key size={17} />
                        </button>
                        <button 
                          onClick={() => handleEdit(user)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                          title="កែប្រែព័ត៌មាន"
                        >
                          <Edit2 size={17} />
                        </button>
                        <button 
                          onClick={() => handleDelete(user.id, user.name)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                          title="លុបគណនី"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
              <h2 className="text-xl font-bold text-slate-800 font-khmer">កែប្រែព័ត៌មានអ្នកប្រើប្រាស់</h2>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">តួនាទី</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                >
                  <option value="teacher">គ្រូបង្រៀន</option>
                  <option value="admin">អ្នកគ្រប់គ្រង</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer">សាខា</label>
                <select
                  value={editForm.branch}
                  onChange={(e) => setEditForm({...editForm, branch: e.target.value})}
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer"
                >
                  {Array.from({ length: 36 }, (_, i) => `BELTEI IS ${i + 1}`).map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-khmer flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key size={15} className="text-amber-500" />
                    ពាក្យសម្ងាត់ថ្មី
                  </span>
                  <span className="text-xs text-slate-400 font-normal font-khmer">ទុកទំនេរបើមិនចង់ប្តូរ</span>
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    placeholder="បញ្ចូលពាក្យសម្ងាត់យ៉ាងតិច ៦ ខ្ទង់..."
                    value={editForm.newPassword}
                    onChange={(e) => setEditForm({...editForm, newPassword: e.target.value})}
                    className="w-full h-11 pl-4 pr-11 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 font-medium font-khmer hover:bg-slate-200 rounded-xl transition-colors text-sm"
              >
                បោះបង់
              </button>
              <button 
                onClick={saveEdit}
                disabled={isSaving}
                className="px-5 py-2.5 bg-blue-600 text-white font-medium font-khmer rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 text-sm"
              >
                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Change Password Modal */}
      {isPasswordModalOpen && passwordTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-amber-500/10 via-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
                  <Key size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 font-khmer">ប្តូរពាក្យសម្ងាត់</h2>
                  <p className="text-xs text-slate-500 font-khmer">កំណត់ពាក្យសម្ងាត់ថ្មីជូនអ្នកប្រើប្រាស់</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangePassword}>
              <div className="p-6 space-y-5">
                {/* Target User Card */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {passwordTargetUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800 font-khmer text-sm truncate">{passwordTargetUser.name}</p>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                        {passwordTargetUser.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{passwordTargetUser.email || 'គ្មាន Email'}</p>
                  </div>
                </div>

                {/* Alerts */}
                {passwordModalError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium font-khmer flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p>{passwordModalError}</p>
                      {passwordModalError.includes('Script') && (
                        <button
                          type="button"
                          onClick={() => setIsSqlModalOpen(true)}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-bold text-xs transition-colors"
                        >
                          <FileCode size={14} /> មើល Script សម្រាប់បញ្ចូលក្នុង Supabase
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {passwordModalSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium font-khmer flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <p>{passwordModalSuccess}</p>
                  </div>
                )}

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide font-khmer">
                      ពាក្យសម្ងាត់ថ្មី
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw size={12} /> បង្កើតចៃដន្យ
                    </button>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="បញ្ចូលយ៉ាងតិច ៦ ខ្ទង់..."
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordModalError('');
                        setPasswordModalSuccess('');
                      }}
                      className="w-full h-11 pl-10 pr-20 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-sans"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                      {newPassword && (
                        <button
                          type="button"
                          onClick={handleCopyPassword}
                          title="ចម្លង Password"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          {isCopied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 font-khmer">
                    * ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៦ ខ្ទង់ឡើងទៅ។
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setIsSqlModalOpen(true)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5"
                >
                  <FileCode size={14} /> SQL Setup
                </button>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-4 py-2 text-slate-600 font-medium font-khmer hover:bg-slate-200 rounded-xl transition-colors text-xs"
                  >
                    បោះបង់
                  </button>
                  <button 
                    type="submit"
                    disabled={isUpdatingPassword || !newPassword}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold font-khmer rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 text-xs flex items-center gap-1.5"
                  >
                    {isUpdatingPassword ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> កំពុងរក្សាទុក...
                      </>
                    ) : (
                      <>
                        <Key size={14} /> ប្តូរពាក្យសម្ងាត់
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SQL Setup Instruction Modal */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <FileCode className="text-blue-600" size={22} />
                <div>
                  <h2 className="text-lg font-bold text-slate-800 font-khmer">ការដំឡើង SQL សម្រាប់ប្តូរពាក្យសម្ងាត់</h2>
                  <p className="text-xs text-slate-500 font-khmer">ដំណើរការ Script នេះម្តងគត់ក្នុង Supabase SQL Editor</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSqlModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-sm font-khmer">
              <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs space-y-1.5">
                <p className="font-bold">📋 ជំហានងាយៗក្នុងការបើកដំណើរការ៖</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>ចុចប៊ូតុង <strong>"ចម្លងកូដ SQL"</strong> ខាងក្រោម</li>
                  <li>បើក Supabase Dashboard គម្រោងរបស់អ្នក 👉 ចូលទៅ <strong>SQL Editor</strong></li>
                  <li>Paste កូដ SQL រួចចុច <strong>Run</strong> ជាការស្រេច!</li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-600 uppercase font-sans">SQL Script (admin_change_password.sql)</span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    {isSqlCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{isSqlCopied ? 'បានចម្លងរួចរាល់!' : 'ចម្លងកូដ SQL'}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto max-h-60 custom-scrollbar border border-slate-800">
                  {SQL_SCRIPT_CONTENT}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-khmer">ឯកសារក៏មានក្នុង project: <code className="font-mono text-slate-600">admin_change_password.sql</code></span>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold font-khmer hover:bg-slate-700"
              >
                យល់ព្រម
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
