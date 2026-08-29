import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Lock, Mail, Phone, MapPin, Camera, AlertCircle, CheckCircle2, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('BELTEI IS 1');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [gmail, setGmail] = useState('');
  const [phone, setPhone] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchAvailableBranches = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('branch')
          .in('role', ['teacher', 'admin']);
          
        if (error) throw error;
        
        const takenBranches = data?.map(p => p.branch) || [];
        const allBranches = Array.from({ length: 32 }, (_, i) => `BELTEI IS ${i + 1}`);
        const free = allBranches.filter(b => !takenBranches.includes(b));
        
        setAvailableBranches(free);
        if (free.length > 0) {
          setBranch(free[0]); // Default to first available
        } else {
          setBranch('');
        }
      } catch (err) {
        console.error("Error fetching branches:", err);
        // Fallback
        const allBranches = Array.from({ length: 32 }, (_, i) => `BELTEI IS ${i + 1}`);
        setAvailableBranches(allBranches);
        setBranch(allBranches[0]);
      } finally {
        setLoadingBranches(false);
      }
    };
    
    fetchAvailableBranches();
  }, []);

  useEffect(() => {
    let subscription: any = null;
    if (success) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          navigate('/');
        }
      });
      subscription = data.subscription;
    }
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [success, navigate]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
            setImagePreview(compressedBase64);
          }
        };
        if (event.target?.result) {
          img.src = event.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    if (!name || !gmail || !password || !phone || !branch) {
      setError('សូមបំពេញព័ត៌មានឲ្យបានគ្រប់គ្រាន់');
      setLoading(false);
      return;
    }

    if (!imageFile) {
      setError('សូមបញ្ចូលរូបថតរបស់អ្នក');
      setLoading(false);
      return;
    }

    // Validate Gmail
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!gmailRegex.test(gmail)) {
      setError('សូមបញ្ចូលគណនី Gmail ឲ្យបានត្រឹមត្រូវ (ត្រូវបញ្ជប់ដោយ @gmail.com)');
      setLoading(false);
      return;
    }

    // Validate Cambodia Phone Number (Starts with 0, total 9-10 digits)
    const cleanPhone = phone.replace(/\s+/g, '');
    const phoneRegex = /^0\d{8,9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setError('សូមបញ្ចូលលេខទូរស័ព្ទកម្ពុជាឲ្យបានត្រឹមត្រូវ (ឧទាហរណ៍៖ 012345678)');
      setLoading(false);
      return;
    }

    // Validate Password
    if (password.length < 6) {
      setError('ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៦ ខ្ទង់');
      setLoading(false);
      return;
    }

    try {
      // Re-validate branch availability right before signup to reduce race window
      const { data: recheckData } = await supabase
        .from('profiles')
        .select('branch')
        .in('role', ['teacher', 'admin'])
        .eq('branch', branch);

      if (recheckData && recheckData.length > 0) {
        setError('សាខានេះត្រូវបានយកទៅហើយ សូមជ្រើសរើសសាខាផ្សេង។');
        // Refresh available branches
        const { data: freshData } = await supabase
          .from('profiles')
          .select('branch')
          .in('role', ['teacher', 'admin']);
        const takenBranches = freshData?.map(p => p.branch) || [];
        const allBranches = Array.from({ length: 32 }, (_, i) => `BELTEI IS ${i + 1}`);
        const free = allBranches.filter(b => !takenBranches.includes(b));
        setAvailableBranches(free);
        if (free.length > 0) setBranch(free[0]);
        setLoading(false);
        return;
      }

      if (imagePreview) {
        localStorage.setItem('pending_profile_image', imagePreview);
      }

      // Sign up user in Auth and store profile data in metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: gmail,
        password,
        options: {
          data: {
            full_name: name,
            branch: branch,
            phone_number: phone,
            role: 'teacher'
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('ការចុះឈ្មោះបរាជ័យ');

      setSuccess(true);
      
    } catch (err: any) {
      // Clean up localStorage on failure to prevent orphaned base64 images
      localStorage.removeItem('pending_profile_image');
      setError(err.message || 'បញ្ហាពេលចុះឈ្មោះ សូមព្យាយាមម្តងទៀត');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E6EBF5] font-khmer p-4">
        <div 
          className="max-w-md w-full rounded-[2.5rem] p-8 md:p-10 m-4 flex flex-col items-center text-center"
          style={{
            backgroundColor: '#E6EBF5',
            boxShadow: '16px 16px 32px #c4c8d1, -16px -16px 32px #ffffff'
          }}
        >
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
            style={{
              backgroundColor: '#E6EBF5',
              boxShadow: '8px 8px 16px #c4c8d1, -8px -8px 16px #ffffff'
            }}
          >
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-[#1E3C72] mb-3">ចុះឈ្មោះជោគជ័យ!</h2>
          <p className="text-slate-600 font-medium leading-relaxed mb-8">
            គណនីរបស់អ្នកត្រូវបានបង្កើតដោយជោគជ័យ។ ប្រព័ន្ធនឹងនាំអ្នកទៅកាន់ Dashboard ឥឡូវនេះ...
          </p>
          
          <div className="flex flex-col items-center gap-4 p-4 rounded-2xl w-full"
            style={{
              boxShadow: 'inset 6px 6px 12px #cbcfd8, inset -6px -6px 12px #ffffff'
            }}
          >
            <span className="w-8 h-8 border-[3px] border-[#0044CC]/30 border-t-[#0044CC] rounded-full animate-spin"></span>
            <p className="text-sm font-bold text-[#0044CC]">កំពុងដំណើរការ...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E6EBF5] font-khmer p-4 relative overflow-hidden text-slate-800 py-10">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none"></div>
      
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
      
      <div 
        className="max-w-2xl w-full rounded-[2.5rem] p-8 sm:p-12 relative z-10"
        style={{
          backgroundColor: '#E6EBF5',
          boxShadow: '16px 16px 32px #c4c8d1, -16px -16px 32px #ffffff'
        }}
      >
        <div className="text-center mb-8 flex flex-col items-center">
          <div 
            className="w-24 h-24 mb-5 rounded-3xl flex items-center justify-center p-2"
            style={{
              backgroundColor: '#E6EBF5',
              boxShadow: '8px 8px 16px #c4c8d1, -8px -8px 16px #ffffff'
            }}
          >
            <img 
              src="/beltei_international_school_in_cambodia.png" 
              alt="Beltei Logo" 
              className="w-full h-full object-contain mix-blend-multiply"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h2 className="text-[26px] font-bold text-[#1E3C72] mb-1">បង្កើតគណនីថ្មី</h2>
          <div className="w-12 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full my-3"></div>
          <p className="text-slate-500 font-medium">សូមបញ្ចូលព័ត៌មានខាងក្រោមដើម្បីចុះឈ្មោះ</p>
        </div>

        {error && (
          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50/50 px-4 py-3 shadow-[inset_2px_2px_5px_#fca5a5,inset_-2px_-2px_5px_#ffffff]">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
            <p className="text-[13px] font-medium text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6">
          {/* Profile Image Upload */}
          <div className="flex flex-col items-center justify-center mb-8">
            <div 
              className="relative w-28 h-28 rounded-full flex items-center justify-center overflow-hidden cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
              style={{
                backgroundColor: '#E6EBF5',
                boxShadow: imagePreview 
                  ? '8px 8px 16px #c4c8d1, -8px -8px 16px #ffffff' 
                  : 'inset 6px 6px 12px #cbcfd8, inset -6px -6px 12px #ffffff'
              }}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={36} className="text-slate-400" />
              )}
              <div className="absolute inset-0 bg-[#1E3C72]/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="text-white" size={24} />
              </div>
            </div>
            <p className="text-sm font-bold text-[#1E3C72] mt-4 cursor-pointer hover:underline" onClick={() => fileInputRef.current?.click()}>
              បញ្ចូលរូបថត
            </p>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleImageChange} 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">ឈ្មោះ</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#2A5298] transition-colors">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#E6EBF5] outline-none text-[15px] font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  placeholder="ឈ្មោះរបស់អ្នក"
                  style={{ boxShadow: 'inset 4px 4px 8px #cbcfd8, inset -4px -4px 8px #ffffff' }}
                />
              </div>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">សាខា</label>
              <div className="relative group" ref={dropdownRef}>
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#2A5298] transition-colors z-10">
                  <MapPin size={18} />
                </div>
                <div
                  onClick={() => {
                    if (!loadingBranches && availableBranches.length > 0) {
                      setIsDropdownOpen(!isDropdownOpen);
                    }
                  }}
                  className={`w-full h-12 pl-11 pr-10 rounded-xl bg-[#E6EBF5] outline-none text-[15px] font-medium text-slate-700 flex items-center cursor-pointer transition-all ${loadingBranches || availableBranches.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                  style={{ boxShadow: 'inset 4px 4px 8px #cbcfd8, inset -4px -4px 8px #ffffff' }}
                >
                  <span className="truncate">{loadingBranches ? "កំពុងទាញយកទិន្នន័យ..." : availableBranches.length === 0 ? "អស់សាខាសម្រាប់ចុះឈ្មោះហើយ" : branch}</span>
                </div>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 z-10">
                  <ChevronDown size={18} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {isDropdownOpen && (
                  <div 
                    className="absolute z-50 w-full mt-2 py-2 rounded-2xl bg-[#E6EBF5] max-h-60 overflow-y-auto"
                    style={{
                      boxShadow: '8px 8px 16px #c4c8d1, -8px -8px 16px #ffffff',
                      border: '1px solid rgba(255,255,255,0.3)'
                    }}
                  >
                    {availableBranches.map(b => (
                      <div
                        key={b}
                        onClick={() => {
                          setBranch(b);
                          setIsDropdownOpen(false);
                        }}
                        className={`px-4 py-2.5 cursor-pointer text-[15px] font-medium transition-colors ${branch === b ? 'bg-[#0044CC] text-white font-bold rounded-lg mx-2' : 'text-slate-700 hover:bg-[#d1d9e6] rounded-lg mx-2'}`}
                      >
                        {b}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">អ៊ីមែល</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#2A5298] transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={gmail}
                  onChange={(e) => setGmail(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#E6EBF5] outline-none text-[15px] font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  placeholder="example@gmail.com"
                  style={{ boxShadow: 'inset 4px 4px 8px #cbcfd8, inset -4px -4px 8px #ffffff' }}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">លេខទូរស័ព្ទ</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#2A5298] transition-colors">
                  <Phone size={18} />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#E6EBF5] outline-none text-[15px] font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  placeholder="012 345 678"
                  style={{ boxShadow: 'inset 4px 4px 8px #cbcfd8, inset -4px -4px 8px #ffffff' }}
                />
              </div>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">ពាក្យសម្ងាត់</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#2A5298] transition-colors">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-11 pr-12 rounded-xl bg-[#E6EBF5] outline-none text-[15px] font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                placeholder="បញ្ជូលពាក្យសម្ងាត់ (យ៉ាងតិច ៦ ខ្ទង់)"
                style={{ boxShadow: 'inset 4px 4px 8px #cbcfd8, inset -4px -4px 8px #ffffff' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 mt-8 rounded-2xl bg-[#0044CC] hover:bg-[#0038b3] active:bg-[#002f99] flex items-center justify-center text-white font-bold text-[16px] transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
            style={{
              boxShadow: '8px 8px 16px #c4c8d1, -8px -8px 16px #ffffff'
            }}
          >
            {loading ? (
              <span className="w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'ចុះឈ្មោះបង្កើតគណនី'
            )}
          </button>
          
          <div className="flex items-center gap-4 py-2 mt-4">
            <div className="flex-1 h-px bg-slate-300 shadow-[0_1px_1px_#ffffff]"></div>
          </div>

          <p className="text-center text-sm font-medium text-slate-500 mt-2">
            មានគណនីរួចហើយមែនទេ?{' '}
            <Link to="/login" className="text-[#1E3C72] font-bold hover:underline">
              ចូលគណនី
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
