import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

import { User, Mail, Phone, MapPin, Camera, Save, ShieldAlert, CheckCircle2, LogOut } from 'lucide-react';

const Profile = () => {
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
        
      if (error) throw error;
      
      setProfile(data);
      setName(data.name || '');
      setPhone(data.phone_number || '');
      setImagePreview(data.profile_image_url || null);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      showMessage('មិនអាចទាញយកទិន្នន័យគណនីបានទេ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      setSaving(true);
      
      // Update profile in database
      const { error } = await supabase
        .from('profiles')
        .update({
          name: name,
          phone_number: phone,
          profile_image_url: imagePreview
        })
        .eq('id', user.id);
        
      if (error) throw error;
      
      // Update Auth user metadata
      await supabase.auth.updateUser({
        data: { full_name: name }
      });
      
      showMessage('ព័ត៌មានត្រូវបានរក្សាទុកដោយជោគជ័យ!', 'success');
      fetchProfile();
      
      // Tell AuthContext to refresh profile image for Topbar
      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      showMessage(error.message || 'មានបញ្ហាក្នុងការរក្សាទុកព័ត៌មាន', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('តើអ្នកពិតជាចង់ចាកចេញពីគណនីមែនទេ?')) {
      await supabase.auth.signOut();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-[#2a5298] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full p-2 md:p-0 max-w-4xl mx-auto w-full mt-6">
      {message && (
        <div className={`p-4 rounded-lg font-medium flex items-center gap-3 shadow-sm border animate-in fade-in slide-in-from-top-4 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-[#2a5298] to-[#48b5c9]"></div>
        
        <form onSubmit={handleSaveProfile} className="px-6 pb-8">
          {/* Profile Picture */}
          <div className="relative flex justify-center -mt-16 mb-8">
            <div 
              className="relative w-32 h-32 rounded-full border-4 border-white shadow-lg bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={50} className="text-gray-300" />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="text-white" size={28} />
              </div>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleImageChange} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Name */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">ឈ្មោះ (Name)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2a5298]/20 focus:border-[#2a5298] outline-none transition-all font-medium"
                />
              </div>
            </div>

            {/* Email (Read Only) */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">អ៊ីមែល (Email)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input
                  type="email"
                  readOnly
                  value={profile?.email || ''}
                  className="w-full pl-11 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 font-medium cursor-not-allowed"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">លេខទូរស័ព្ទ (Phone)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone size={18} className="text-gray-400" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#2a5298]/20 focus:border-[#2a5298] outline-none transition-all font-medium"
                />
              </div>
            </div>

            {/* Branch (Read Only) */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">សាខា (Branch)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MapPin size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  readOnly
                  value={profile?.branch || ''}
                  className="w-full pl-11 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 font-medium cursor-not-allowed uppercase"
                />
              </div>
            </div>

            {/* Role (Read Only) */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">តួនាទី (Role)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <ShieldAlert size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  readOnly
                  value="ICT Teacher"
                  className="w-full pl-11 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 font-medium cursor-not-allowed uppercase"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 mt-10 max-w-2xl mx-auto pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-6 py-3 rounded-xl font-bold transition-colors shadow-sm"
            >
              <LogOut size={20} />
              ចាកចេញពីគណនី (Logout)
            </button>
            
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-[#2a5298] hover:bg-[#1e3c72] text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save size={20} />
              )}
              រក្សាទុក (Save)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
