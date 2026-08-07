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
          throw new Error(
            'មិនមានឈ្មោះនេះក្នុងប្រព័ន្ធទេ សូមពិនិត្យម្តងទៀត។'
          );
        }

        if (matches.length > 1) {
          throw new Error(
            'មានគណនីច្រើនដែលមានឈ្មោះដូចគ្នា។ សូមប្រើ Email ដើម្បីចូលគណនីជំនួស។'
          );
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
      setError(
        err.message || 'បញ្ហាពេលចូលគណនី សូមព្យាយាមម្តងទៀត'
      );
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
    <div className="relative min-h-screen overflow-hidden bg-[#F4F7FB] font-khmer text-slate-900">
      {/* Soft premium background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#2A5298]/10 blur-3xl" />
        <div className="absolute bottom-[-220px] right-[-160px] h-[420px] w-[420px] rounded-full bg-[#48B5C9]/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2A5298]/25 to-transparent" />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
        <section className="w-full max-w-[430px]">
          {/* Brand */}
          <div className="mb-7 text-center">
            <div className="mx-auto mb-5 flex h-[74px] items-center justify-center">
              <img
                src="/Asset 1@3x.png"
                alt="BELTEI International School"
                className="max-h-[68px] w-auto max-w-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900 sm:text-[30px]">
              ចូលគណនី
            </h1>
            <p className="mt-1.5 text-[15px] font-medium text-slate-500">
              ICT Lab Management System
            </p>
          </div>

          {/* Login card */}
          <div className="rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-7">
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5"
              >
                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0 text-red-500"
                />
                <p className="text-sm font-medium leading-6 text-red-700">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Identifier */}
              <div>
                <label
                  htmlFor="identifier"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  ឈ្មោះ ឬ Email
                </label>

                <div className="group relative">
                  <User
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#2A5298]"
                  />

                  <input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="វាយបញ្ចូលឈ្មោះ ឬ Email..."
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-12 pr-4 text-[15px] font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#2A5298] focus:bg-white focus:ring-4 focus:ring-[#2A5298]/10"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  ពាក្យសម្ងាត់
                </label>

                <div className="group relative">
                  <Lock
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#2A5298]"
                  />

                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-12 pr-12 text-[15px] font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#2A5298] focus:bg-white focus:ring-4 focus:ring-[#2A5298]/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword
                        ? 'លាក់ពាក្យសម្ងាត់'
                        : 'បង្ហាញពាក្យសម្ងាត់'
                    }
                    className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2A5298]/20"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember */}
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-[18px] w-[18px] rounded border-slate-300 accent-[#2A5298] focus:ring-[#2A5298]"
                  />
                  <span className="text-sm font-medium text-slate-600">
                    ចងចាំគណនី
                  </span>
                </label>
              </div>

              {/* Primary action */}
              <button
                type="submit"
                disabled={isBusy}
                className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#254E8E] px-4 text-[16px] font-bold text-white shadow-[0_10px_24px_rgba(37,78,142,0.24)] transition-all hover:bg-[#1F437B] hover:shadow-[0_12px_28px_rgba(37,78,142,0.30)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <>
                    <LogIn size={19} />
                    ចូលគណនី
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold text-slate-400">
                  ឬ
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isBusy}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {googleLoading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#2A5298]/25 border-t-[#2A5298]" />
                ) : (
                  <>
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    បន្តជាមួយ Google
                  </>
                )}
              </button>

              {/* Register */}
              <p className="pt-1 text-center text-sm font-medium text-slate-500">
                មិនទាន់មានគណនីមែនទេ?{' '}
                <Link
                  to="/register"
                  className="font-bold text-[#2A5298] transition hover:text-[#1F437B] hover:underline"
                >
                  ចុះឈ្មោះ
                </Link>
              </p>
            </form>
          </div>

          {/* Developer / bypass */}
          <button
            type="button"
            onClick={handleBypass}
            className="mx-auto mt-5 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/60 hover:text-slate-600"
          >
            <Sparkles size={12} />
            រំលងការចូលគណនី
          </button>

          <p className="mt-3 text-center text-[11px] font-medium tracking-wide text-slate-400">
            BELTEI INTERNATIONAL SCHOOL · ICT LAB
          </p>
        </section>
      </main>
    </div>
  );
};

export default Login;
