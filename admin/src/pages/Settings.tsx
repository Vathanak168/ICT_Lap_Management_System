import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, Save, User, Shield, Key, Bot } from 'lucide-react';

const Settings = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  
  // AI Keys State
  const [geminiKeys, setGeminiKeys] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [savingAi, setSavingAi] = useState(false);
  
  useEffect(() => {
    fetchProfile();
    fetchAiSettings();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') throw error; // Ignore not found
      } else {
        setProfile(data);
        setName(data.name || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'ai_keys')
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.config_json) {
        const config = data.config_json as any;
        if (config.geminiKeys && Array.isArray(config.geminiKeys)) {
          setGeminiKeys(config.geminiKeys.join(', '));
        }
        if (config.groqKey) {
          setGroqKey(config.groqKey);
        }
      }
    } catch (error) {
      console.error('Error fetching AI settings:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          name: name,
          email: session.user.email,
          role: 'admin',
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      alert('បានរក្សាទុកជោគជ័យ។');
      fetchProfile();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('មានបញ្ហាក្នុងការរក្សាទុក។');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAiKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAi(true);
      
      const config = {
        geminiKeys: geminiKeys.split(',').map(k => k.trim()).filter(k => k),
        groqKey: groqKey.trim()
      };

      const { error } = await supabase
        .from('settings')
        .upsert({
          id: 'ai_keys',
          config_json: config
        });

      if (error) throw error;
      alert('រក្សាទុក AI API Keys ជោគជ័យ។ AI នឹងប្រើប្រាស់ Keys ទាំងនេះសម្រាប់ប្រព័ន្ធទាំងមូល។');
    } catch (error) {
      console.error('Error saving AI settings:', error);
      alert('មានបញ្ហាក្នុងការរក្សាទុក AI Settings។ សូមប្រាកដថាអ្នកមានសិទ្ធិជា Admin។');
    } finally {
      setSavingAi(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 font-khmer flex items-center gap-3">
          <div className="p-2 bg-slate-200 text-slate-700 rounded-lg">
            <SettingsIcon size={24} />
          </div>
          ការកំណត់
        </h1>
        <p className="text-slate-500 font-khmer text-sm">កំណត់ព័ត៌មានគណនីរបស់អ្នក</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
          <div className="card p-6 text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 mx-auto mb-4 border-4 border-white shadow-lg flex items-center justify-center">
              <Shield size={40} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">{profile?.name || 'Admin'}</h2>
            <span className="inline-block mt-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border border-purple-200">
              អ្នកគ្រប់គ្រងប្រព័ន្ធ
            </span>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-3">
              <User size={20} className="text-blue-600" />
              ព័ត៌មានផ្ទាល់ខ្លួន
            </h3>
            
            {loading ? (
              <p className="text-slate-500 font-khmer py-4 text-center">កំពុងទាញយកទិន្នន័យ...</p>
            ) : (
              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 font-khmer">ឈ្មោះរបស់អ្នក</label>
                  <input
                    type="text"
                    required
                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-khmer text-slate-700 placeholder:text-slate-400 placeholder:font-khmer"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ឧ. សុខ សាន្ត"
                  />
                </div>
                
                <div className="pt-2 flex justify-end">
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Save size={18} />
                    {saving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកការប្រែប្រួល'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="card p-6 border-red-200">
            <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2 border-b border-red-100 pb-3">
              <Key size={20} />
              សុវត្ថិភាពគណនី
            </h3>
            <p className="text-slate-600 font-khmer text-sm mb-4 leading-relaxed">
              អ្នកអាចផ្លាស់ប្តូរលេខសម្ងាត់ ឬកំណត់រចនាសម្ព័ន្ធសុវត្ថិភាពផ្សេងៗនៅទីនេះ។
            </p>
            <button className="btn-danger w-full sm:w-auto">
              ផ្លាស់ប្តូរពាក្យសម្ងាត់
            </button>
          </div>

          <div className="card p-6 border-indigo-200">
            <h3 className="text-lg font-bold text-indigo-700 mb-4 flex items-center gap-2 border-b border-indigo-100 pb-3">
              <Bot size={20} />
              កំណត់រចនាសម្ព័ន្ធ AI
            </h3>
            <p className="text-slate-600 font-khmer text-sm mb-4 leading-relaxed">
              Keys ដែលដាក់បញ្ចូលនៅទីនេះ នឹងត្រូវបានអនុញ្ញាតឱ្យប្រើប្រាស់ដោយគ្រប់អ្នកប្រើប្រាស់ ទាំងអស់នៅក្នុងប្រព័ន្ធ។
            </p>
            
            <form onSubmit={handleSaveAiKeys} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Gemini API Keys (ខណ្ឌដោយសញ្ញាក្បៀស)</label>
                <textarea
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm text-slate-700 h-24"
                  value={geminiKeys}
                  onChange={(e) => setGeminiKeys(e.target.value)}
                  placeholder="AIzaSy..., AIzaSy..., AIzaSy..."
                />
                <p className="text-xs text-slate-500 mt-1">អ្នកអាចដាក់បញ្ជូល Keys ច្រើនបាន ដើម្បីឲ្យប្រព័ន្ធផ្លាស់ប្តូរស្វ័យប្រវត្តិពេលមាន Key ណាមួយពេញ Limit។</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Groq API Key (Fallback)</label>
                <input
                  type="text"
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm text-slate-700"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                />
                <p className="text-xs text-slate-500 mt-1">ប្រសិនបើ Gemini គាំងទាំងអស់ ប្រព័ន្ធនឹងប្តូរទៅប្រើ Groq ស្វ័យប្រវត្តិ។</p>
              </div>
              
              <div className="pt-2 flex justify-end">
                <button 
                  type="submit" 
                  disabled={savingAi}
                  className="btn-primary flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
                >
                  <Save size={18} />
                  {savingAi ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក AI Keys'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
