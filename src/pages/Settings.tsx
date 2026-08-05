import React, { useRef, useState } from 'react';
import { DownloadCloud, UploadCloud, Trash2, ShieldAlert, FileSpreadsheet } from 'lucide-react';
import { exportDatabase, importDatabase, clearDatabase } from '../utils/backup';
import { initDB } from '../store/db';
import { exportToExcel } from '../utils/excel';
import { PageHeader } from '../components/ui/PageHeader';

const Settings = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  
  // Gemini API Key State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSaveApiKey = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    showMessage('រក្សាទុក API Key ជោគជ័យ!', 'success');
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleExportBackup = async () => {
    setLoading(true);
    const success = await exportDatabase();
    if (success) {
      showMessage('ទាញយកទិន្នន័យបម្រុង (Backup) ជោគជ័យ!', 'success');
    } else {
      showMessage('មានបញ្ហាក្នុងការទាញយកទិន្នន័យបម្រុង', 'error');
    }
    setLoading(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const success = await importDatabase(file);
    if (success) {
      showMessage('បញ្ចូលទិន្នន័យ (Restore) ជោគជ័យ!', 'success');
      // Optionally reload the page to apply changes
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showMessage('ឯកសារមិនត្រឹមត្រូវ ឬមានបញ្ហា', 'error');
    }
    setLoading(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExportStudentsExcel = async () => {
    const db = await initDB();
    const students = await db.getAll('students');
    
    const formattedData = students.map((s, i) => ({
      'ល.រ': i + 1,
      'អត្តលេខ': s.studentId,
      'ឈ្មោះសិស្ស': s.name,
      'ភេទ': s.gender === 'M' ? 'ប្រុស' : 'ស្រី',
      'ថ្នាក់': s.class,
      'វេន': s.shift,
      'លេខកុំព្យូទ័រ': s.pcNumber || '---',
      'លេខសម្ងាត់': s.password || '---',
      'ស្ថានភាព': s.status === 'Active' ? 'កំពុងសិក្សា' : 'ឈប់'
    }));

    exportToExcel(formattedData, `Students_List_${new Date().toISOString().split('T')[0]}`);
  };

  const handleClearData = async () => {
    if (window.confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យទាំងអស់មែនទេ? សកម្មភាពនេះមិនអាចទាញមកវិញបានទេ!')) {
      if (window.confirm('សូមបញ្ជាក់ម្តងទៀត (បាទ/ចាស = លុប)')) {
        setLoading(true);
        const success = await clearDatabase();
        if (success) {
          alert('ទិន្នន័យត្រូវបានលុបដោយជោគជ័យ!');
          window.location.reload();
        } else {
          showMessage('មានបញ្ហាក្នុងការលុបទិន្នន័យ', 'error');
        }
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full p-2 md:p-0">
      <PageHeader>
        <div className="flex items-center gap-3">
          <ShieldAlert size={28} className="text-[#2a5298]" />
          <div>
            <h1 className="text-2xl font-bold text-[#2a5298] font-khmer">ការកំណត់ (Settings)</h1>
            <p className="text-sm text-gray-500 font-khmer mt-1">គ្រប់គ្រងទិន្នន័យ ប្រព័ន្ធ និងការកំណត់ទូទៅ</p>
          </div>
        </div>
      </PageHeader>


      {message && (
        <div className={`p-4 rounded-lg font-medium flex items-center gap-3 shadow-sm border animate-in fade-in slide-in-from-top-4 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message.type === 'success' ? <DownloadCloud size={20} /> : <ShieldAlert size={20} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Backup Card */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <DownloadCloud size={24} />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2 border-b border-gray-100 pb-3">បម្រុងទុកទិន្នន័យ (Backup & Restore)</h2>
          <p className="text-sm text-gray-500 mb-6 flex-1">រក្សាទុកទិន្នន័យរបស់អ្នកជា File JSON ដើម្បីការពារការបាត់បង់ពេលមានបញ្ហាកុំព្យូទ័រ ឬប្តូរ Browser។</p>
          
          <div className="flex flex-col gap-3">
            <button 
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-bold transition-all" 
              onClick={handleExportBackup}
              disabled={loading}
            >
              <DownloadCloud size={18} />
              <span>ទាញយកទិន្នន័យ (Backup)</span>
            </button>
            
            <button 
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-green-500 hover:text-green-600 hover:bg-green-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-bold transition-all" 
              onClick={handleImportClick}
              disabled={loading}
            >
              <UploadCloud size={18} />
              <span>បញ្ចូលទិន្នន័យ (Restore)</span>
            </button>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange}
            />
          </div>
        </section>

        {/* Excel Export Card */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <FileSpreadsheet size={24} />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2 border-b border-gray-100 pb-3">នាំចេញជា Excel (Export Excel)</h2>
          <p className="text-sm text-gray-500 mb-6 flex-1">ទាញយកទិន្នន័យពីក្នុងប្រព័ន្ធទៅជាឯកសារ Excel ដើម្បីងាយស្រួលក្នុងការផ្ញើ ឬ Print ទុកជាឯកសារយោង។</p>
          
          <div className="flex flex-col gap-3">
            <button 
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow-md" 
              onClick={handleExportStudentsExcel}
            >
              <FileSpreadsheet size={18} />
              <span>បញ្ជីសិស្ស (Students)</span>
            </button>
            
            <button className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-bold transition-all">
              <FileSpreadsheet size={18} />
              <span>តារាងពិន្ទុ (Grades)</span>
            </button>
          </div>
        </section>

        {/* AI Setup Card */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col transition-all hover:shadow-md relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100 to-transparent rounded-bl-full opacity-50 z-0"></div>
          
          <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 relative z-10">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-lg font-bold text-[#2a5298] mb-2 border-b border-gray-100 pb-3 relative z-10">ជំនួយការ AI (Gemini AI)</h2>
          <p className="text-sm text-gray-500 mb-6 flex-1 relative z-10">បញ្ចូល Gemini API Key របស់អ្នក ដើម្បីបើកដំណើរការជំនួយការ AI។ កូដនេះត្រូវបានរក្សាទុកតែលើ Browser របស់អ្នកប៉ុណ្ណោះ។</p>
          
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center gap-2">
              <input 
                type={showApiKey ? "text" : "password"} 
                className="flex-1 bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg px-4 py-2.5 outline-none focus:border-[#48b5c9] focus:ring-2 focus:ring-[#48b5c9]/20 transition-all font-mono"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button 
                className="bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold transition-colors shrink-0"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? 'លាក់' : 'បង្ហាញ'}
              </button>
            </div>
            <button 
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#2a5298] to-[#3a72c4] hover:from-[#1e3c72] hover:to-[#2a5298] text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow-md"
              onClick={handleSaveApiKey}
            >
              រក្សាទុក Key
            </button>
          </div>
        </section>

        {/* Danger Zone Card */}
        <section className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6 flex flex-col transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-lg bg-red-100 text-red-600 flex items-center justify-center mb-4">
            <Trash2 size={24} />
          </div>
          <h2 className="text-lg font-bold text-red-700 mb-2 border-b border-red-200 pb-3">Danger Zone</h2>
          <p className="text-sm text-red-600/80 mb-6 flex-1">លុបទិន្នន័យទាំងអស់ចេញពីប្រព័ន្ធនេះ។ សូមប្រាកដថាអ្នកបានធ្វើ Backup ទិន្នន័យរួចរាល់ជាមុនសិន។ សកម្មភាពនេះមិនអាចទាញមកវិញបានទេ!</p>
          
          <div className="flex flex-col gap-3">
            <button 
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow-md hover:ring-4 ring-red-600/20" 
              onClick={handleClearData} 
              disabled={loading}
            >
              <Trash2 size={18} />
              <span>លុបទិន្នន័យទាំងអស់ (Clear All Data)</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
