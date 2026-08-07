import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Sparkles,
  User,
  Monitor,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      let emailToLogin = identifier.trim();
      const isEmail = emailToLogin.includes('@');

      if (!isEmail) {
        const { data: matches, error: lookupError } = await supabase
          .from('profiles')
          .select('email, name')
          .ilike('name', emailToLogin);

        if (lookupError) throw lookupError;

        if (!matches || matches.length === 0) {
          throw new Error('មិនមានឈ្មោះនេះក្នុងប្រព័ន្ធទេ សូមពិនិត្យម្តងទៀត។');
        }

        if (matches.length > 1) {
          throw new Error('មានគណនីច្រើនដែលមានឈ្មោះដូចគ្នា។ សូមប្រើ Email ដើម្បីចូលគណនីជំនួស។');
        }

        emailToLogin = matches[0].email;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password,
      });

      if (error) throw error;

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
          redirectTo: window.location.origin,
        },
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

  const isBusy = loading || googleLoading;

  return (
    <div className="min-h-screen flex font-khmer overflow-hidden bg-white selection:bg-[#2A5298] selection:text-white">
      {/* LEFT PANEL - BRANDING & VISUALS (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#1e3c72] via-[#2a5298] to-[#152a51] text-white flex-col justify-between p-12 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/20 blur-[120px]" />
          <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] rounded-full bg-cyan-400/10 blur-[80px]" />
          
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDUpIiBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik00MCAwaC00MHY0MGg0MFoiLz48L2c+PC9zdmc+')] opacity-50" />
        </div>

        {/* Top Logo */}
        <div className="relative z-10">
          <img
            src="/Asset 1@3x.png"
            alt="BELTEI Logo"
            className="h-16 w-auto object-contain bg-white/10 p-2 rounded-xl backdrop-blur-sm border border-white/20"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Center Content */}
        <div className="relative z-10 max-w-lg mt-10">
          <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight mb-6 tracking-tight">
            ប្រព័ន្ធគ្រប់គ្រង<br />បន្ទប់កុំព្យូទ័រទំនើប
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed mb-10 opacity-90">
            ផ្តល់ជូននូវបទពិសោធន៍គ្រប់គ្រងទិន្នន័យសិស្ស វត្តមាន និងការរៀបចំប្លង់កៅអី ដ៏ឆ្លាតវៃ និងមានសុវត្ថិភាពបំផុត។
          </p>

          {/* Feature Badges */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="bg-blue-500/30 p-2 rounded-lg"><Monitor size={20} className="text-blue-200" /></div>
              <span className="font-semibold text-sm">គ្រប់គ្រងឧបករណ៍</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="bg-green-500/30 p-2 rounded-lg"><ShieldCheck size={20} className="text-green-200" /></div>
              <span className="font-semibold text-sm">សុវត្ថិភាពទិន្នន័យ</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="bg-yellow-500/30 p-2 rounded-lg"><Zap size={20} className="text-yellow-200" /></div>
              <span className="font-semibold text-sm">ដំណើរការលឿន</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="bg-purple-500/30 p-2 rounded-lg"><Sparkles size={20} className="text-purple-200" /></div>
              <span className="font-semibold text-sm">រចនាបថទំនើប</span>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 text-blue-200/60 text-sm font-medium">
          &copy; {new Date().getFullYear()} BELTEI International School. All rights reserved.
        </div>
      </div>

      {/* RIGHT PANEL - LOGIN FORM */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-[#F8FAFC]">
        
        {/* Mobile background decors */}
        <div className="absolute lg:hidden top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[80px] pointer-events-none" />
        <div className="absolute lg:hidden bottom-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          
          {/* Mobile Logo Header */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <img
              src="/Asset 1@3x.png"
              alt="BELTEI Logo"
              className="h-14 w-auto object-contain mb-4"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <h2 className="text-2xl font-bold text-slate-800">ចូលគណនី</h2>
            <p className="text-slate-500 text-sm mt-1">ICT Lab Management System</p>
          </div>

          <div className="hidden lg:block mb-10">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">សូមស្វាគមន៍មកកាន់ប្រព័ន្ធ 👋</h2>
            <p className="text-slate-500 font-medium">សូមបញ្ចូលព័ត៌មានខាងក្រោមដើម្បីចូលប្រើប្រាស់គណនី</p>
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100">
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-sm font-medium leading-relaxed text-red-800">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Identifier Input */}
              <div>
                <label htmlFor="identifier" className="mb-2 block text-sm font-bold text-slate-700 ml-1">
                  ឈ្មោះ ឬ Email
                </label>
                <div className="group relative">
                  <User size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#2A5298]" />
                  <input
                    id="identifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="វាយបញ្ចូលឈ្មោះ ឬ Email..."
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-12 pr-4 text-base font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 hover:bg-white hover:border-slate-300 focus:border-[#2A5298] focus:bg-white focus:ring-[4px] focus:ring-[#2A5298]/15 shadow-sm"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label htmlFor="password" className="block text-sm font-bold text-slate-700">
                    ពាក្យសម្ងាត់
                  </label>
                  <a href="#" className="text-xs font-bold text-[#2A5298] hover:underline hover:text-[#1e3c72] transition-colors">
                    ភ្លេចពាក្យសម្ងាត់?
                  </a>
                </div>
                
                <div className="group relative">
                  <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#2A5298]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-12 pr-12 text-base font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 hover:bg-white hover:border-slate-300 focus:border-[#2A5298] focus:bg-white focus:ring-[4px] focus:ring-[#2A5298]/15 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2A5298]/20"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isBusy}
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1e3c72] to-[#2a5298] px-4 text-lg font-bold text-white shadow-[0_8px_20px_rgba(42,82,152,0.25)] transition-all hover:shadow-[0_12px_25px_rgba(42,82,152,0.35)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {loading ? (
                  <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
                ) : (
                  <>
                    <LogIn size={20} className="mr-1" />
                    ចូលគណនីប្រព័ន្ធ
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 py-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ឬចូលតាមរយៈ</span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200" />
              </div>

              {/* Google Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isBusy}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-100 bg-white px-4 text-base font-bold text-slate-700 transition-all hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:opacity-70 shadow-sm"
              >
                {googleLoading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#2A5298]" />
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span>ភ្ជាប់គណនី Google</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-sm font-semibold text-slate-500">
            មិនទាន់មានគណនីមែនទេ?{' '}
            <Link to="/register" className="text-[#2A5298] hover:text-[#1e3c72] hover:underline transition-all">
              ចុះឈ្មោះប្រើប្រាស់ទីនេះ
            </Link>
          </p>
          
          <div className="flex justify-center mt-6">
            <button
              onClick={handleBypass}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-200/50 text-slate-500 text-xs font-bold hover:bg-slate-200 hover:text-slate-700 transition-colors"
            >
              <Sparkles size={14} />
              ចូលសាកល្បង
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
