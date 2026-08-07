import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAcademicYear } from '../../contexts/AcademicYearContext';

import { useState } from 'react';
import AIAssistant from '../ai/AIAssistant';

const Topbar = () => {
  const { profileImage } = useAuth();
  const { activeYear, academicYears, changeYear, createYear } = useAcademicYear();
  const navigate = useNavigate();
  
  const [showNewYearModal, setShowNewYearModal] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearInput.trim()) return;
    
    // Validate format like 2026-2027
    if (!/^\d{4}-\d{4}$/.test(newYearInput)) {
      alert('ទម្រង់មិនត្រឹមត្រូវ សូមវាយបញ្ចូលទម្រង់ "YYYY-YYYY" ឧទាហរណ៍: "2027-2028"');
      return;
    }
    
    setCreating(true);
    const success = await createYear(newYearInput);
    if (success) {
      setShowNewYearModal(false);
      setNewYearInput('');
    } else {
      alert('ឆ្នាំសិក្សានេះមានរួចហើយ ឬមានបញ្ហាក្នុងការបង្កើត');
    }
    setCreating(false);
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

        {/* Language Select Removed */}

        {/* Academic Year Select */}
        <div className="hidden sm:flex items-center">
          <select 
            value={activeYear || ''}
            onChange={(e) => {
              if (e.target.value === 'new') {
                setShowNewYearModal(true);
              } else if (e.target.value) {
                changeYear(e.target.value);
              }
            }}
            className="bg-white/10 hover:bg-white/20 text-white text-sm rounded-sm px-3 py-1.5 border border-white/20 hover:border-white/40 outline-none focus:bg-white focus:text-gray-800 focus:border-white transition-all font-medium cursor-pointer"
          >
            {!activeYear && <option value="" disabled>-- ជ្រើសរើស --</option>}
            {academicYears.map(y => (
              <option key={y.id} value={y.year} className="text-gray-800">{y.year}</option>
            ))}
            <option value="new" className="text-[#2a5298] font-bold">+ បង្កើតឆ្នាំសិក្សាថ្មី</option>
          </select>
        </div>

        {/* User Profile */}
        <div 
          className="flex items-center gap-2 cursor-pointer hover:bg-white/10 p-1.5 md:px-3 md:py-1.5 rounded-sm transition-all border border-transparent hover:border-white/20"
          onClick={() => navigate('/profile')}
        >
          <div className="hidden md:flex flex-col items-end mr-1">
            <span className="text-[13px] font-bold text-white tracking-wide">ICT Teacher</span>
          </div>
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center border border-white/30 overflow-hidden shadow-sm">
            {profileImage ? (
              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={16} className="text-white" />
            )}
          </div>
        </div>
      </div>

      {/* New Academic Year Modal */}
      {showNewYearModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl animate-in zoom-in-95 font-khmer text-gray-800">
            <h3 className="text-lg font-bold mb-4 text-[#2a5298]">បង្កើតឆ្នាំសិក្សាថ្មី</h3>
            <form onSubmit={handleCreateYear}>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">ឆ្នាំសិក្សា (ឧ. 2027-2028)</label>
                <input
                  type="text"
                  required
                  placeholder="YYYY-YYYY"
                  value={newYearInput}
                  onChange={(e) => setNewYearInput(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#2a5298]/20 focus:border-[#2a5298] outline-none transition-all font-medium"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewYearModal(false)}
                  className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-[#2a5298] hover:bg-[#1e3c72] text-white font-bold rounded-lg shadow-sm transition-colors disabled:opacity-70"
                >
                  {creating ? 'កំពុងបង្កើត...' : 'បង្កើតឥឡូវនេះ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

export default Topbar;
