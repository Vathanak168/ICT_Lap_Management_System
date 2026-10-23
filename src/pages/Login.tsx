import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Lock,
  LogIn,
  User
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const navigate = useNavigate();
  const { session } = useAuth();
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) {
      navigate('/');
    }
  }, [session, navigate]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      if (!identifier || !password) {
        throw new Error("សូមបំពេញឈ្មោះ និងពាក្យសម្ងាត់ឱ្យបានគ្រប់ជ្រុងជ្រោយ។");
      }

      let emailToLogin = identifier.trim();
      const isEmail = emailToLogin.includes('@');

      if (!isEmail) {
        // Query profiles by name.
        const { data: matches, error: lookupError } = await supabase
          .from('profiles')
          .select('email, name')
          .ilike('name', emailToLogin);

        if (lookupError) throw lookupError;

        if (!matches || matches.length === 0) {
          // Standardized generic error to prevent user enumeration
          throw new Error('INVALID_CREDENTIALS');
        }

        if (matches.length > 1) {
          throw new Error('MULTIPLE_ACCOUNTS');
        }

        emailToLogin = matches[0].email;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password,
      });

      if (signInError) throw signInError;

      navigate('/');
    } catch (err: any) {
      const msg = err?.message || '';
      if (
        msg === 'INVALID_CREDENTIALS' ||
        msg.includes('Invalid login credentials') ||
        msg.includes('invalid_grant') ||
        msg.includes('User not found')
      ) {
        // Unified error message for both wrong username and wrong password
        setError('ឈ្មោះគណនី/អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។ សូមពិនិត្យម្តងទៀត។');
      } else if (msg === 'MULTIPLE_ACCOUNTS' || msg.includes('មានគណនីច្រើន')) {
        setError('មានគណនីច្រើនដែលមានឈ្មោះដូចគ្នា។ សូមប្រើ Email ដើម្បីចូលគណនីជំនួស។');
      } else if (msg.includes('Email not confirmed')) {
        setError('អ៊ីមែលនេះមិនទាន់បានបញ្ជាក់ (Confirm) នៅឡើយទេ។ សូមពិនិត្យប្រអប់សំបុត្ររបស់អ្នក។');
      } else if (msg.includes('សូមបំពេញ')) {
        setError(msg);
      } else {
        setError('មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ប្រព័ន្ធ សូមព្យាយាមម្តងទៀតនៅពេលបន្តិចក្រោយ។');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setError(null);
    setInfoMessage('មុខងារចូលគណនីជាមួយ Google (SSO) កំពុងស្ថិតក្នុងការអភិវឌ្ឍន៍ និងគ្រោងដាក់ឱ្យប្រើប្រាស់ក្នុងពេលឆាប់ៗនេះ។');
  };

  const isBusy = loading || googleLoading;

  return (
    <div className="min-h-screen font-khmer bg-[#E6EBF5] flex items-center justify-center p-4 relative overflow-hidden text-slate-800">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />
      
      {/* SVG Background decoration (Soft abstract circles) */}
      <div className="absolute top-0 right-0 w-full h-full pointer-events-none overflow-hidden opacity-[0.15]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <circle cx="95" cy="5" r="40" fill="url(#grad1)" />
          <circle cx="5" cy="95" r="30" fill="url(#grad1)" />
          <defs>
            <radialGradient id="grad1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <stop offset="0%" style={{ stopColor: '#2a5298', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#2a5298', stopOpacity: 0 }} />
            </radialGradient>
          </defs>
        </svg>
      </div>

      <div className="flex w-full max-w-6xl gap-10 items-center justify-center relative z-10">
        
        {/* Main Login Card - NEUMORPHISM */}
        <div 
          className="w-full max-w-[500px] p-8 sm:p-12 rounded-[2.5rem] flex flex-col items-center relative z-20"
          style={{
            backgroundColor: '#E6EBF5',
            boxShadow: '16px 16px 32px #c4c8d1, -16px -16px 32px #ffffff'
          }}
        >
          {/* Logo 3D Effect */}
          <div 
            className="w-28 h-28 mb-6 rounded-3xl flex items-center justify-center p-2"
            style={{
              backgroundColor: '#E6EBF5',
              boxShadow: '8px 8px 16px #c4c8d1, -8px -8px 16px #ffffff'
            }}
          >
            <img
              src="/beltei_international_school_in_cambodia.png"
              alt="BELTEI Logo"
              className="w-full h-full object-contain mix-blend-multiply"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          <h1 className="text-2xl sm:text-[26px] font-bold text-center text-[#1E3C72] mb-1">
            ប្រព័ន្ធគ្រប់គ្រងបន្ទប់កុំព្យូទ័រ
          </h1>
          
          <div className="w-12 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full my-4"></div>

          <h2 className="text-[19px] font-bold text-slate-700">សូមស្វាគមន៍ការត្រឡប់មកវិញ</h2>
          <p className="text-sm font-medium text-slate-500 mb-8 text-center">
            សូមចូលគណនីដើម្បីបន្ត
          </p>

          {error && (
            <div className="w-full mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50/50 px-4 py-3 shadow-[inset_2px_2px_5px_#fca5a5,inset_-2px_-2px_5px_#ffffff]">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-[13px] font-medium leading-relaxed text-red-700">
                {error}
              </p>
            </div>
          )}

          {infoMessage && (
            <div className="w-full mb-6 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 shadow-[inset_2px_2px_5px_#bfdbfe,inset_-2px_-2px_5px_#ffffff]">
              <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
              <p className="text-[13px] font-medium leading-relaxed text-blue-800">
                {infoMessage}
              </p>
            </div>
          )}

          <div className="w-full space-y-6">
            {/* Input Email */}
            <div className="relative group">
              <div 
                className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#2A5298] transition-colors"
              >
                <User size={18} />
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && passwordRef.current?.focus()}
                placeholder="ឈ្មោះ ឬ អ៊ីមែល"
                className="w-full h-14 pl-12 pr-4 rounded-2xl bg-[#E6EBF5] outline-none text-[15px] font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                style={{
                  boxShadow: 'inset 6px 6px 12px #cbcfd8, inset -6px -6px 12px #ffffff'
                }}
              />
            </div>

            {/* Input Password */}
            <div className="relative group">
              <div 
                className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#2A5298] transition-colors"
              >
                <Lock size={18} />
              </div>
              <input
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="ពាក្យសម្ងាត់"
                className="w-full h-14 pl-12 pr-12 rounded-2xl bg-[#E6EBF5] outline-none text-[15px] font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                style={{
                  boxShadow: 'inset 6px 6px 12px #cbcfd8, inset -6px -6px 12px #ffffff'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex justify-between items-center px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div 
                  className="w-5 h-5 rounded-[5px] flex items-center justify-center transition-all"
                  style={{
                    backgroundColor: '#E6EBF5',
                    boxShadow: remember 
                      ? 'inset 2px 2px 5px #cbcfd8, inset -2px -2px 5px #ffffff' 
                      : '3px 3px 6px #c4c8d1, -3px -3px 6px #ffffff'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="opacity-0 absolute w-0 h-0"
                  />
                  {remember && <div className="w-2.5 h-2.5 rounded-[2px] bg-[#2A5298]" />}
                </div>
                <span className="text-sm font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                  ចងចាំខ្ញុំ
                </span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-sm font-bold text-[#1E3C72] hover:underline cursor-pointer bg-transparent border-none p-0"
              >
                ភ្លេចពាក្យសម្ងាត់?
              </button>
            </div>

            {/* Sign In Button */}
            <button
              onClick={() => handleLogin()}
              disabled={isBusy}
              className="w-full h-14 rounded-2xl bg-[#0044CC] hover:bg-[#0038b3] active:bg-[#002f99] flex items-center justify-center text-white font-bold text-[16px] transition-all disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
              style={{
                boxShadow: '8px 8px 16px #c4c8d1, -8px -8px 16px #ffffff'
              }}
            >
              {loading ? (
                <span className="w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  <span>ចូលគណនី</span>
                  <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </button>

            <div className="flex items-center gap-4 py-1">
              <div className="flex-1 h-px bg-slate-300 shadow-[0_1px_1px_#ffffff]"></div>
              <span className="text-xs font-bold text-slate-400">ឬ</span>
              <div className="flex-1 h-px bg-slate-300 shadow-[0_1px_1px_#ffffff]"></div>
            </div>

            {/* Google Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isBusy}
              aria-label="ចូលគណនីជាមួយ Google (ឆាប់ៗនេះ)"
              title="មុខងារចូលគណនីជាមួយ Google នឹងបើកដំណើរការឆាប់ៗនេះ"
              className="w-full h-14 rounded-2xl flex items-center justify-center gap-3 font-bold text-[15px] text-slate-700 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#E6EBF5',
                boxShadow: '8px 8px 16px #c4c8d1, -8px -8px 16px #ffffff'
              }}
            >
              {googleLoading ? (
                <span className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>ចូលគណនីជាមួយ Google</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">ឆាប់ៗនេះ</span>
                </>
              )}
            </button>

            {/* Register Link */}
            <p className="text-center text-sm font-medium text-slate-500 mt-2">
              មិនទាន់មានគណនីមែនទេ?{' '}
              <Link to="/register" className="text-[#1E3C72] font-bold hover:underline">
                ចុះឈ្មោះនៅទីនេះ
              </Link>
            </p>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div 
              className="bg-[#E6EBF5] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-white/60 text-slate-800 flex flex-col"
              style={{
                boxShadow: '16px 16px 32px #c4c8d1, -16px -16px 32px #ffffff'
              }}
            >
              <h3 className="text-lg font-bold text-[#1E3C72] mb-3 flex items-center gap-2">
                <Lock size={20} />
                <span>ជំនួយការភ្លេចពាក្យសម្ងាត់</span>
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
                ដើម្បីសុវត្ថិភាពទិន្នន័យប្រព័ន្ធ ប្រសិនបើលោកអ្នកភ្លេចពាក្យសម្ងាត់ ឬមិនអាចចូលគណនីបាន សូមទាក់ទងមកកាន់ <strong>អ្នកគ្រប់គ្រងប្រព័ន្ធ (Admin)</strong> ឬ <strong>ការិយាល័យ IT</strong> ដើម្បីស្នើសុំកំណត់ពាក្យសម្ងាត់ថ្មី។
              </p>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-full py-3.5 rounded-2xl bg-[#0044CC] hover:bg-[#0038b3] text-white font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                យល់ព្រម
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Login;