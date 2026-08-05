import { Globe, User, ChevronDown, LogOut } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import AIAssistant from '../ai/AIAssistant';

const Topbar = () => {
  const { language, toggleLanguage } = useLanguage();
  const { user, role } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="h-[60px] bg-[#2a5298] text-white px-4 md:px-6 flex items-center justify-between shrink-0 print:hidden shadow-md z-20">
      {/* Left side: Logo & Title */}
        <div className="flex items-center justify-center mr-1">
          <img src="/Asset 2@3x (2).png" alt="BELTEI Logo" className="h-10 w-[180px] md:w-[220px] object-fill" />
        </div>

      {/* Right side: Controls */}
      <div className="flex items-center gap-3 md:gap-5">
        
        {/* AI Assistant Trigger */}
        <AIAssistant />

        {/* Language Select */}
        <button 
          onClick={toggleLanguage}
          className="hidden md:flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-sm border border-white/20 hover:border-white/40 transition-all text-sm"
        >
          <Globe size={16} />
          <span>{language === 'KH' ? 'ខ្មែរ' : 'English'}</span>
          <ChevronDown size={14} className="opacity-70" />
        </button>

        {/* Academic Year Select */}
        <div className="hidden sm:flex items-center">
          <select className="bg-white/10 hover:bg-white/20 text-white text-sm rounded-sm px-3 py-1.5 border border-white/20 hover:border-white/40 outline-none focus:bg-white focus:text-gray-800 focus:border-white transition-all font-medium cursor-pointer">
            <option>2026-2027</option>
            <option>2025-2026</option>
          </select>
        </div>

        {/* User Profile */}
        <div className="relative">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:bg-white/10 p-1.5 md:px-3 md:py-1.5 rounded-sm transition-all border border-transparent hover:border-white/20"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold leading-tight truncate max-w-[150px]">{user?.email || 'គណនី'}</span>
              <span className="text-[10px] text-blue-200 capitalize">{role || 'Teacher'}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
              <User size={16} />
            </div>
            <ChevronDown size={14} className="opacity-70 hidden md:block" />
          </div>

          {showDropdown && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg py-1 z-50 text-gray-700 font-khmer">
              <div className="px-4 py-2 border-b border-gray-100 md:hidden">
                <p className="text-sm font-bold truncate">{user?.email}</p>
                <p className="text-xs text-gray-500 capitalize">{role || 'Teacher'}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2 transition-colors"
              >
                <LogOut size={16} /> ចាកចេញ (Logout)
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
