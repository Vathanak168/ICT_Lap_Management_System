import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, Lock, User, AlertCircle, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState(''); // Can be Name or Email
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      navigate('/');
    }
  }, [session, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      let emailToLogin = identifier;
      
      // Check if identifier looks like an email
      const isEmail = identifier.includes('@');
      
      if (!isEmail) {
        // Lookup by name — check for duplicates across branches
        const { data: matches, error: lookupError } = await supabase
          .from('profiles')
          .select('email, name')
          .ilike('name', identifier);
        
        if (lookupError) throw lookupError;
        
        if (!matches || matches.length === 0) {
          throw new Error('មិនមានឈ្មោះនេះក្នុងប្រព័ន្ធទេ សូមពិនិត្យម្តងទៀត។');
        }
        
        if (matches.length > 1) {
          // Multiple users with the same name — ask to use email instead
          throw new Error('មានគណនីច្រើនដែលមានឈ្មោះដូចគ្នា។ សូមប្រើ Email ដើម្បីចូលគណនីជំនួស។');
        }
        
        emailToLogin = matches[0].email;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password,
      });

      if (error) {
        throw error;
      }
      
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'បញ្ហាពេលចូលគណនី សូមព្យាយាមម្តងទៀត');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'បញ្ហាពេលភ្ជាប់ Google');
      setGoogleLoading(false);
    }
  };

  const handleBypass = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] font-khmer p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#2a5298]/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#48b5c9]/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-10 border border-white/60 relative z-10">
        <div className="text-center mb-10">
          <img 
            src="/Asset 1@3x.png" 
            alt="Beltei Logo" 
            className="w-full max-w-[310px] h-[60px] mx-auto mb-6 drop-shadow-sm object-fill"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/310x60?text=BELTEI+LOGO';
            }}
          />
          <h2 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">ចូលគណនី</h2>
          <p className="text-gray-500 font-medium">ICT Lab Management System</p>
        </div>

        {error && (
          <div className="mb-8 bg-red-50/80 backdrop-blur border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3 shadow-sm animate-pulse-once">
            <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
            <p className="text-sm text-red-700 font-medium leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">ឈ្មោះ</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[#2a5298]">
                <User size={18} className="text-gray-400 group-focus-within:text-[#2a5298]" />
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2a5298]/20 focus:border-[#2a5298] outline-none transition-all shadow-sm text-gray-800 font-medium"
                placeholder="វាយបញ្ចូលឈ្មោះ..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">ពាក្យសម្ងាត់</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[#2a5298]">
                <Lock size={18} className="text-gray-400 group-focus-within:text-[#2a5298]" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2a5298]/20 focus:border-[#2a5298] outline-none transition-all shadow-sm text-gray-800 font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-[#2a5298] focus:ring-[#2a5298]" />
              <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">ចងចាំគណនី</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#2a5298] to-[#1e3c72] hover:from-[#1e3c72] hover:to-[#152a51] text-white py-3.5 px-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 mt-2"
          >
            {loading ? (
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn size={20} /> ចូលគណនី
              </>
            )}
          </button>
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium">ឬ</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full flex justify-center items-center gap-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-3.5 px-4 rounded-xl font-bold transition-all shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
               <div className="w-6 h-6 border-3 border-[#2a5298] border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                បន្តជាមួយ Google
              </>
            )}
          </button>

          <p className="text-center text-sm text-gray-500 mt-6 font-medium">
            មិនទាន់មានគណនីមែនទេ?{' '}
            <Link to="/register" className="text-[#2a5298] font-bold hover:underline">
              ចុះឈ្មោះ
            </Link>
          </p>

          {/* Dev Mode Bypass */}
          <div className="mt-8 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleBypass}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1"
            >
              <Sparkles size={12} /> រំលងការចូលគណនី
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
