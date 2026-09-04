import { useState } from 'react';
import { User, Calendar, Trash2, X, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import AIAssistant from '../ai/AIAssistant';

const Topbar = () => {
  const { user, profileImage, role, branch } = useAuth();
  const { activeYear, academicYears, changeYear, createYear, deleteYear } = useAcademicYear();
  const navigate = useNavigate();
  
  const [showNewYearModal, setShowNewYearModal] = useState(false);
  const [showDeleteYearModal, setShowDeleteYearModal] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorText, setErrorText] = useState('');

  const displayName = user?.user_metadata?.full_name || 'ICT Teacher';
  const roleDisplay = role === 'admin' ? 'អ្នកគ្រប់គ្រង (Admin)' : (branch ? `សាខាទី ${branch}` : 'គ្រូបង្រៀន ICT');

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    if (!newYearInput.trim()) return;
    
    // Validate format like 2026-2027
    if (!/^\d{4}-\d{4}$/.test(newYearInput.trim())) {
      setErrorText('ទម្រង់មិនត្រឹមត្រូវ សូមវាយបញ្ចូលទម្រង់ "YYYY-YYYY" ឧទាហរណ៍: "2027-2028"');
      return;
    }
    
    setCreating(true);
    const success = await createYear(newYearInput.trim());
    if (success) {
      setShowNewYearModal(false);
      setNewYearInput('');
    } else {
      setErrorText('ឆ្នាំសិក្សានេះមានរួចហើយ ឬមានបញ្ហាក្នុងការបង្កើត');
    }
    setCreating(false);
  };

  const handleDeleteYear = async () => {
    if (!activeYear) return;
    setCreating(true);
    try {
      await deleteYear(activeYear);
      setShowDeleteYearModal(false);
    } catch (error) {
      console.error('Failed to delete year:', error);
      alert('មានបញ្ហាក្នុងការលុបឆ្នាំសិក្សា');
    } finally {
      setCreating(false);
    }
  };

  return (
    <header className="h-[62px] bg-gradient-to-r from-blue-800 via-indigo-800 to-blue-900 text-white px-4 md:px-6 flex items-center justify-between shrink-0 print:hidden border-b border-white/10 shadow-xs z-30">
      {/* Left side: Logo & Branding */}
      <div className="flex items-center gap-3">
        <div className="flex items-center py-1">
          <img 
            src="/Asset 2@3x (2).png" 
            alt="BELTEI International School Logo" 
            className="h-9 sm:h-10 w-auto max-w-[210px] sm:max-w-[250px] object-contain object-left drop-shadow-xs" 
          />
        </div>
      </div>

      {/* Right side: Controls & Profile */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        
        {/* AI Assistant Trigger */}
        <AIAssistant />

        {/* Academic Year Selector Pill */}
        <div className="hidden sm:flex items-center gap-1.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-3 py-1.5 transition-all shadow-2xs">
          <Calendar size={14} className="text-blue-200 shrink-0" />
          <select 
            value={activeYear || ''}
            onChange={(e) => {
              if (e.target.value === 'new') {
                setErrorText('');
                setShowNewYearModal(true);
              } else if (e.target.value) {
                changeYear(e.target.value);
              }
            }}
            className="bg-transparent text-white text-xs sm:text-sm font-bold outline-none cursor-pointer pr-1"
          >
            {!activeYear && <option value="" disabled className="text-gray-800">-- ជ្រើសរើស --</option>}
            {academicYears.map(y => (
              <option key={y.id} value={y.year} className="text-gray-800 font-medium">
                ឆ្នាំសិក្សា {y.year}
              </option>
            ))}
            {role === 'admin' && (
              <option value="new" className="text-blue-700 font-bold">
                + បង្កើតឆ្នាំសិក្សាថ្មី
              </option>
            )}
          </select>
          {activeYear && role === 'admin' && (
            <button
              type="button"
              onClick={() => setShowDeleteYearModal(true)}
              className="text-white/60 hover:text-rose-300 hover:bg-white/10 p-1 rounded-lg transition-colors cursor-pointer"
              title="លុបឆ្នាំសិក្សានេះ"
              disabled={creating}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* User Profile Chip */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer hover:bg-white/10 p-1 sm:pl-3 sm:pr-2 sm:py-1 rounded-xl transition-all border border-transparent hover:border-white/15 active:scale-98"
          onClick={() => navigate('/profile')}
          title="មើលគណនីរបស់អ្នក"
        >
          <div className="hidden md:flex flex-col items-end leading-tight">
            <span className="text-xs sm:text-sm font-bold text-white tracking-wide">{displayName}</span>
            <span className="text-[10px] text-blue-200/80 font-medium">{roleDisplay}</span>
          </div>
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30 overflow-hidden shadow-xs">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={18} className="text-white" />
              )}
            </div>
            {/* Active Online Status Indicator */}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-indigo-900 shadow-xs" />
          </div>
        </div>
      </div>

      {/* New Academic Year Modal */}
      {showNewYearModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-border/80 shadow-2xl max-w-md w-full overflow-hidden text-main-text animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-border/80 bg-background/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-main-text">បង្កើតឆ្នាំសិក្សាថ្មី</h3>
                  <p className="text-xs text-secondary-text">បន្ថែមឆ្នាំសិក្សាសម្រាប់ការគ្រប់គ្រងទិន្នន័យ</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowNewYearModal(false)} 
                className="text-secondary-text hover:text-main-text hover:bg-surface-hover p-1.5 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateYear} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-secondary-text uppercase tracking-wider mb-2">
                  ឆ្នាំសិក្សាថ្មី (ឧទាហរណ៍: 2027-2028) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="YYYY-YYYY"
                  value={newYearInput}
                  onChange={(e) => setNewYearInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border text-main-text rounded-xl font-bold outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs text-sm"
                  autoFocus
                />
                {errorText && (
                  <p className="text-rose-600 text-xs font-medium mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={13} />
                    <span>{errorText}</span>
                  </p>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-border/80">
                <button
                  type="button"
                  onClick={() => setShowNewYearModal(false)}
                  disabled={creating}
                  className="px-4 py-2 text-xs font-bold text-secondary-text hover:text-main-text hover:bg-surface-hover rounded-xl border border-border transition-all shadow-2xs cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-70 cursor-pointer inline-flex items-center gap-1.5"
                >
                  {creating ? 'កំពុងបង្កើត...' : 'បង្កើតឥឡូវនេះ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Academic Year Confirmation Modal */}
      {showDeleteYearModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-border/80 shadow-2xl max-w-sm w-full p-6 text-main-text animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-center text-main-text mb-2">
              តើអ្នកពិតជាចង់លុបឆ្នាំសិក្សានេះមែនទេ?
            </h3>
            <p className="text-xs text-secondary-text text-center mb-6 leading-relaxed">
              អ្នករៀបនឹងលុបឆ្នាំសិក្សា <strong className="text-rose-600 font-bold">{activeYear}</strong>។<br />
              <span className="italic text-rose-600/90 font-medium">ការព្រមាន៖ ទិន្នន័យថ្នាក់ និងសិស្សទាំងអស់ក្នុងឆ្នាំនេះអាចនឹងត្រូវបានលុប!</span>
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteYearModal(false)}
                disabled={creating}
                className="flex-1 py-2.5 rounded-xl border border-border text-secondary-text hover:text-main-text hover:bg-surface-hover text-xs font-bold transition-all cursor-pointer"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={handleDeleteYear}
                disabled={creating}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                {creating ? 'កំពុងលុប...' : 'យល់ព្រមលុប'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Topbar;
