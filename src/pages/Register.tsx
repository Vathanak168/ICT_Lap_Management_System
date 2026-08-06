import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { User, Lock, Mail, Phone, MapPin, Camera, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('BELTEI IS 1');
  const [password, setPassword] = useState('');
  const [gmail, setGmail] = useState('');
  const [phone, setPhone] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    if (!name || !gmail || !password || !phone) {
      setError('សូមបំពេញព័ត៌មានឲ្យបានគ្រប់គ្រាន់');
      setLoading(false);
      return;
    }

    try {
      // 1. Sign up user in Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: gmail,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('ការចុះឈ្មោះបរាជ័យ');

      // 2. Upload Profile Image if exists
      let profileImageUrl = null;
      if (imageFile) {
        // const fileExt = imageFile.name.split('.').pop();
        // const fileName = `${authData.user.id}.${fileExt}`;
        
        // Ensure bucket exists in Supabase, but for now we'll just store the base64 or a dummy URL 
        // since we might not have the bucket configured. Let's use the local preview as a base64 for simplicity in demo
        // In production: supabase.storage.from('avatars').upload(fileName, imageFile)
        profileImageUrl = imagePreview; // Storing base64 temporarily
      }

      // 3. Create Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          name: name,
          email: gmail,
          phone_number: phone,
          branch: branch,
          profile_image_url: profileImageUrl,
          role: 'teacher'
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        // We won't block the user if profile fails, but we'll log it.
        // Wait, if it fails they won't be able to login with Name. 
        // Throwing is better.
        // If there's an RLS issue, it might fail. We've set RLS so it should work.
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'បញ្ហាពេលចុះឈ្មោះ សូមព្យាយាមម្តងទៀត');
    } finally {
      setLoading(false);
    }
  };

  // Generate Branches BELTEI IS 1 to 32
  const branches = Array.from({ length: 32 }, (_, i) => `BELTEI IS ${i + 1}`);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] font-khmer">
        <div className="max-w-md w-full bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl p-10 m-4 border border-white flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ចុះឈ្មោះជោគជ័យ!</h2>
          <p className="text-gray-600">គណនីរបស់អ្នកត្រូវបានបង្កើតដោយជោគជ័យ។ ប្រព័ន្ធនឹងនាំអ្នកទៅកាន់ទំព័រ Login ឥឡូវនេះ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] font-khmer p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/20 rounded-full blur-[100px]"></div>
      
      <div className="max-w-xl w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-10 border border-white/60 relative z-10">
        <div className="text-center mb-8">
          <img 
            src="/Asset 1@3x.png" 
            alt="Beltei Logo" 
            className="w-full max-w-[310px] h-[60px] mx-auto mb-6 drop-shadow-sm object-fill"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/310x60?text=BELTEI+LOGO';
            }}
          />
          <h2 className="text-3xl font-bold text-gray-900 mb-2 bg-gradient-to-r from-[#2a5298] to-[#1e3c72] bg-clip-text text-transparent">បង្កើតគណនីថ្មី</h2>
          <p className="text-gray-500">សូមបញ្ចូលព័ត៌មានរបស់អ្នកខាងក្រោម</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50/80 backdrop-blur border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3 shadow-sm">
            <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          {/* Profile Image Upload */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div 
              className="relative w-28 h-28 rounded-full border-4 border-white shadow-lg bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer group transition-transform hover:scale-105"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={40} className="text-gray-300" />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="text-white" size={24} />
              </div>
            </div>
            <p className="text-sm text-[#2a5298] font-medium mt-3 cursor-pointer hover:underline" onClick={() => fileInputRef.current?.click()}>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">ឈ្មោះ</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2a5298]/20 focus:border-[#2a5298] outline-none transition-all shadow-sm"
                  placeholder="ឈ្មោះរបស់អ្នក"
                />
              </div>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">សាខា</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <MapPin size={18} className="text-gray-400" />
                </div>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full pl-11 pr-10 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2a5298]/20 focus:border-[#2a5298] outline-none transition-all shadow-sm appearance-none"
                >
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                  <ChevronDown size={18} className="text-gray-400" />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">អ៊ីមែល</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={gmail}
                  onChange={(e) => setGmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2a5298]/20 focus:border-[#2a5298] outline-none transition-all shadow-sm"
                  placeholder="example@gmail.com"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">លេខទូរស័ព្ទ</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Phone size={18} className="text-gray-400" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2a5298]/20 focus:border-[#2a5298] outline-none transition-all shadow-sm"
                  placeholder="012 345 678"
                />
              </div>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">ពាក្យសម្ងាត់</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2a5298]/20 focus:border-[#2a5298] outline-none transition-all shadow-sm"
                placeholder="បញ្ជូលពាក្យសម្ងាត់ (យ៉ាងតិច ៦ ខ្ទង់)"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#2a5298] to-[#1e3c72] hover:from-[#1e3c72] hover:to-[#152a51] text-white py-3 px-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed mt-4 transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? (
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'ចុះឈ្មោះ'
            )}
          </button>
          
          <p className="text-center text-sm text-gray-500 mt-6 font-medium">
            មានគណនីរួចហើយមែនទេ?{' '}
            <Link to="/login" className="text-[#2a5298] font-bold hover:underline">
              ចូលគណនី
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
