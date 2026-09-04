import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Auto redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Map username to email
    let loginEmail = username.trim();
    if (loginEmail.toLowerCase() === 'admin' || loginEmail.toLowerCase() === 'vathanak') {
      loginEmail = 'vathanak@gmail.com';
    } else if (!loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@beltei.edu.kh`;
    }

    let { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    // Auto sign-up fallback if account doesn't exist
    if (error && error.message.includes('Invalid login credentials')) {
      const signUpResult = await supabase.auth.signUp({
        email: loginEmail,
        password,
      });
      
      if (signUpResult.data?.user && !signUpResult.error) {
        // Sign up successful, the session should be established if email confirmation is disabled
        data = signUpResult.data as any;
        error = null;
      } else if (signUpResult.error) {
        // If sign up also fails, keep the original error
        error = signUpResult.error as any;
      }
    }

    if (error) {
      setError(error.message);
    } else if (data.user) {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-khmer">
      {/* Premium Background Effects */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/10 overflow-hidden relative z-10 p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <ShieldCheck size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-wide">ប្រព័ន្ធគ្រប់គ្រង</h1>
          <p className="text-slate-400 font-medium text-sm">ICT Lab Management System</p>
        </div>
        
        {error && (
          <div className="mb-8 bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3 shadow-sm animate-pulse-once">
            <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={18} />
            <p className="text-sm text-red-200 font-medium leading-relaxed">{error}</p>
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 ml-1">ឈ្មោះអ្នកប្រើប្រាស់</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-400">
                <User size={18} className="text-slate-500 group-focus-within:text-blue-400" />
              </div>
              <input
                type="text"
                required
                className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all shadow-sm text-slate-100 font-medium font-khmer placeholder-slate-500 placeholder:font-khmer"
                placeholder="ឧ. admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 ml-1">ពាក្យសម្ងាត់</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-400">
                <Lock size={18} className="text-slate-500 group-focus-within:text-blue-400" />
              </div>
              <input
                type="password"
                required
                className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all shadow-sm text-slate-100 font-medium placeholder-slate-500"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3.5 px-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'ចូលប្រព័ន្ធ'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
