import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, SearchX } from 'lucide-react';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/40 flex items-center justify-center p-4 font-khmer">
      <div className="w-full max-w-lg bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-slate-100 flex flex-col items-center text-center relative overflow-hidden">
        {/* Decorative soft glow */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-20 h-20 rounded-2xl bg-blue-50 text-[#1E3C72] flex items-center justify-center mb-6 shadow-inner">
          <SearchX size={42} strokeWidth={1.75} />
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-100/70 text-[#1E3C72] mb-3">
          កំហុស 404 / Error 404
        </span>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
          រកមិនឃើញទំព័រនេះទេ
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mb-8 leading-relaxed max-w-sm">
          ទំព័រដែលលោកអ្នកកំពុងស្វែងរកប្រហែលជាត្រូវបានផ្លាស់ប្តូរ ឬមិនមាននៅក្នុងប្រព័ន្ធឡើយ។
          <span className="block text-xs text-slate-400 mt-1">
            The page you are looking for does not exist or has been moved.
          </span>
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 active:scale-95 transition-all cursor-pointer text-sm"
          >
            <ArrowLeft size={18} />
            <span>ថយក្រោយ</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0044CC] hover:bg-[#0038b3] text-white font-medium shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer text-sm"
          >
            <Home size={18} />
            <span>ទៅកាន់ផ្ទាំងដើម</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
