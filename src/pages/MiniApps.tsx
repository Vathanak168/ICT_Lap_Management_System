import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AppWindow, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface MiniApp {
  id: string;
  name: string;
  url: string;
  icon_url: string;
  branch: string;
}

const MiniApps = () => {
  const { user } = useAuth();
  const [apps, setApps] = useState<MiniApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApps();
  }, [user]);

  const fetchApps = async () => {
    try {
      setLoading(true);
      const branchFilters = ['ទូទៅ'];
      
      // Fetch user's branch if they are logged in
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('branch')
          .eq('id', user.id)
          .single();
          
        if (profile?.branch) {
          branchFilters.push(profile.branch);
        }
      }
      
      const { data, error } = await supabase
        .from('mini_apps')
        .select('*')
        .in('branch', branchFilters)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setApps(data || []);
    } catch (error) {
      console.error('Error fetching mini apps:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-7xl mx-auto py-4">
      {/* Main Container with Glassmorphism */}
      <div className="relative z-10 mt-6">
        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_40px_rgb(0,0,0,0.04)] border border-white/80 p-8 sm:p-12 relative overflow-hidden">
          
          {/* Decorative gradients inside container */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-100/40 to-transparent rounded-full blur-3xl pointer-events-none -z-10"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-100/40 to-transparent rounded-full blur-3xl pointer-events-none -z-10"></div>

          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="text-gray-500 font-khmer animate-pulse">កំពុងទាញយកទិន្នន័យកម្មវិធី...</div>
            </div>
          ) : apps.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
              <div className="p-6 bg-gray-50 rounded-full mb-6 shadow-inner border border-gray-100">
                <AppWindow size={64} className="text-gray-300" />
              </div>
              <h2 className="text-2xl font-bold text-gray-700 font-khmer mb-3">មិនមានកម្មវិធីទេ</h2>
              <p className="text-gray-500 font-khmer max-w-md mx-auto">មិនទាន់មាន Mini App ណាមួយត្រូវបានបន្ថែមដោយ Admin នៅឡើយទេ។</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 sm:gap-x-8 sm:gap-y-10">
              {apps.map((app, index) => (
                <a 
                  key={app.id} 
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center group cursor-pointer relative z-10 animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                >
                  <div className="w-24 h-24 sm:w-[110px] sm:h-[110px] rounded-[28px] bg-white p-4 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 group-hover:-translate-y-3 group-hover:shadow-[0_15px_35px_rgba(79,70,229,0.2)] transition-all duration-300 ease-out relative overflow-hidden mb-4">
                    {/* Hover Glow */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-50/80 to-purple-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    <img 
                      src={app.icon_url} 
                      alt={app.name} 
                      className="w-full h-full object-contain relative z-10 group-hover:scale-110 transition-transform duration-500 ease-out"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/96?text=APP' }}
                    />
                  </div>
                  
                  <h3 className="text-[15px] font-semibold text-gray-700 text-center line-clamp-1 w-full px-2 group-hover:text-indigo-600 transition-colors duration-300">
                    {app.name}
                  </h3>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MiniApps;
