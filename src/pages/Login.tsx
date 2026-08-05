import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, Lock, Mail, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
      
      // Successfully logged in, AuthContext will handle redirect
    } catch (err: any) {
      setError(err.message || 'បញ្ហាពេលចូលគណនី សូមព្យាយាមម្តងទៀត');
    } finally {
      setLoading(false);
    }
  };

  const handleBypass = () => {
    // Force a mock redirect for dev purposes
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-khmer">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 m-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-[#2a5298] mb-4">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ចូលប្រព័ន្ធគ្រប់គ្រង</h2>
          <p className="text-gray-500 text-sm">ICT Lab Management System</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 flex items-start gap-3">
            <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">អ៊ីមែល (Email)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-[#2a5298] focus:border-[#2a5298] outline-none transition-colors"
                placeholder="ឈ្មោះគណនី@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ពាក្យសម្ងាត់ (Password)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-[#2a5298] focus:border-[#2a5298] outline-none transition-colors"
                placeholder="បញ្ជូលពាក្យសម្ងាត់"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 bg-[#2a5298] hover:bg-[#1e3c72] text-white py-2.5 px-4 rounded-md font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn size={20} /> ចូលគណនី (Login)
              </>
            )}
          </button>
          
          {/* Dev Mode Bypass */}
          <button
            type="button"
            onClick={handleBypass}
            className="w-full text-sm text-gray-500 hover:text-gray-700 underline mt-4"
          >
            រំលងការចូលគណនី (Skip Login - Dev Mode)
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
