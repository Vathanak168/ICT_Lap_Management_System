import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Users, BookOpen } from 'lucide-react';
import { initDB } from '../store/db';
import type { ClassRecord } from '../store/db';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';

const Classes = () => {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('All');
  
  const [currentClass, setCurrentClass] = useState<Partial<ClassRecord>>({
    name: '', shift: 'Morning', academicYear: '2026-2027', notes: '', linkedClassIds: []
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    const db = await initDB();
    const allClasses = await db.getAll('classes');
    setClasses(allClasses);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!currentClass.name) newErrors.name = 'សូមបញ្ចូលឈ្មោះថ្នាក់';
    if (!currentClass.academicYear) newErrors.academicYear = 'សូមបញ្ចូលឆ្នាំសិក្សា';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const db = await initDB();
    const id = currentClass.id || `${currentClass.name}_${currentClass.shift}`;
    const newClass: ClassRecord = {
      id,
      name: currentClass.name!,
      shift: currentClass.shift as 'Morning' | 'Afternoon' | 'Evening',
      academicYear: currentClass.academicYear!,
      notes: currentClass.notes || '',
      linkedClassIds: currentClass.linkedClassIds || []
    };

    const tx = db.transaction('classes', 'readwrite');
    await tx.store.put(newClass);

    // Also symmetrically update linked classes if they don't have this class linked
    if (newClass.linkedClassIds && newClass.linkedClassIds.length > 0) {
      for (const linkedId of newClass.linkedClassIds) {
        const linkedClass = await tx.store.get(linkedId);
        if (linkedClass) {
          const currentLinks = linkedClass.linkedClassIds || [];
          if (!currentLinks.includes(newClass.id)) {
            linkedClass.linkedClassIds = [...currentLinks, newClass.id];
            await tx.store.put(linkedClass);
          }
        }
      }
    }
    
    await tx.done;

    setShowModal(false);
    loadClasses();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('តើអ្នកពិតជាចង់លុបថ្នាក់នេះមែនទេ? សិស្សទាំងអស់ដែលនៅក្នុងថ្នាក់នេះក៏នឹងត្រូវលុបចោលផងដែរ!')) {
      const db = await initDB();
      
      // 1. Delete all students in this class
      const allStudents = await db.getAll('students');
      const studentsInClass = allStudents.filter(s => s.class === id);
      const studentTx = db.transaction('students', 'readwrite');
      for (const s of studentsInClass) {
        await studentTx.store.delete(s.id);
      }
      await studentTx.done;

      // 2. Delete the class itself
      const classTx = db.transaction('classes', 'readwrite');
      await classTx.store.delete(id);
      await classTx.done;
      
      loadClasses();
    }
  };

  const openEditModal = (c: ClassRecord) => {
    setErrors({});
    setCurrentClass(c);
    setShowModal(true);
  };
  
  const openAddModal = () => {
    setErrors({});
    setCurrentClass({ name: '', shift: 'Morning', academicYear: '2026-2027', notes: '', linkedClassIds: [] });
    setShowModal(true);
  };

  const toggleLinkedClass = (classId: string) => {
    const current = currentClass.linkedClassIds || [];
    if (current.includes(classId)) {
      setCurrentClass({ ...currentClass, linkedClassIds: current.filter(id => id !== classId) });
    } else {
      setCurrentClass({ ...currentClass, linkedClassIds: [...current, classId] });
    }
  };

  // Get unique academic years for filter
  const academicYears = Array.from(new Set(classes.map(c => c.academicYear)));

  const filteredClasses = classes.filter(c => {
    const matchYear = filterYear === 'All' || c.academicYear === filterYear;
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchYear && matchSearch;
  });

  return (
    <div className="flex flex-col w-full pb-10">
      
      {/* Top Panel: Filters & Actions */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>កំណត់លក្ខខណ្ឌ (Filter Classes)</span>
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-end">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ស្វែងរក (Search)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-gray-400" />
                </div>
                <input 
                  type="text"
                  placeholder="ស្វែងរកឈ្មោះថ្នាក់..."
                  className="w-full min-w-[250px] bg-white border border-gray-300 text-gray-800 text-sm rounded-sm pl-9 pr-3 py-2 outline-none focus:border-[#48b5c9] focus:ring-1 focus:ring-[#48b5c9] transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">ឆ្នាំសិក្សា (Academic Year)</label>
              <select 
                className="w-full min-w-[200px] bg-white border border-gray-300 text-gray-800 text-sm rounded-sm px-3 py-2 outline-none focus:border-[#48b5c9] focus:ring-1 focus:ring-[#48b5c9] transition-all cursor-pointer"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="All">គ្រប់ឆ្នាំសិក្សា</option>
                {academicYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <button 
              className="bg-[#48b5c9] hover:bg-[#3aa3b7] hover:shadow-md text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-all border border-transparent" 
              onClick={openAddModal}
            >
              <Plus size={16} /> បង្កើតថ្នាក់ថ្មី
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Table */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-6">
        <div className="bg-[#2a5298] text-white px-4 py-2 font-bold text-sm flex justify-between items-center">
          <span>បញ្ជីថ្នាក់រៀន (List of Classes)</span>
          <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded">សរុប {filteredClasses.length} ថ្នាក់</span>
        </div>
        <div className="overflow-x-auto p-0">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-[#f8f9fa] text-gray-800 sticky top-0 z-10 border-b border-gray-300">
              <tr>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ឈ្មោះថ្នាក់</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">វេនសិក្សា</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ឆ្នាំសិក្សា</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">ចំណាំ</th>
                <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="border-b border-gray-100 px-5 py-4 font-bold text-gray-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#2a5298]">
                      <Users size={16} />
                    </div>
                    {c.name}
                  </td>
                  <td className="border-b border-gray-100 px-5 py-4">
                    {c.shift === 'Morning' && <span className="bg-orange-100 text-orange-800 text-xs px-2.5 py-1 rounded-sm font-medium">វេនព្រឹក</span>}
                    {c.shift === 'Afternoon' && <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-sm font-medium">វេនរសៀល</span>}
                    {c.shift === 'Evening' && <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-1 rounded-sm font-medium">វេនយប់</span>}
                  </td>
                  <td className="border-b border-gray-100 px-5 py-4 text-sm font-medium text-gray-700">{c.academicYear}</td>
                  <td className="border-b border-gray-100 px-5 py-4 text-sm text-gray-500">{c.notes || '---'}</td>
                  <td className="border-b border-gray-100 px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => openEditModal(c)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-sm transition-colors"
                        title="កែប្រែ"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                        title="លុបថ្នាក់"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClasses.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center justify-center p-12 text-secondary-text">
                      <div className="w-12 h-12 bg-background-selected rounded-full flex items-center justify-center mb-4">
                        <BookOpen size={24} className="text-secondary-text" />
                      </div>
                      <p className="text-base font-medium">មិនមានទិន្នន័យថ្នាក់ទេ</p>
                      <p className="text-sm mt-1">សូមបង្កើតថ្នាក់ថ្មី ដើម្បីចាប់ផ្តើម។</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        title={currentClass.id ? 'កែប្រែថ្នាក់រៀន' : 'បង្កើតថ្នាក់ថ្មី'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">ឈ្មោះថ្នាក់ (ឧ. 6A) *</label>
            <Input 
              value={currentClass.name} 
              onChange={(e) => setCurrentClass({...currentClass, name: e.target.value})}
              error={!!errors.name}
            />
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-primary mb-1">វេនសិក្សា *</label>
            <select 
              className="block w-full rounded-lg border-border focus:border-primary focus:ring-primary sm:text-sm py-2 px-3 border bg-white"
              value={currentClass.shift}
              onChange={(e) => setCurrentClass({...currentClass, shift: e.target.value as any})}
            >
              <option value="Morning">ព្រឹក</option>
              <option value="Afternoon">រសៀល</option>
              <option value="Evening">យប់</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-primary mb-1">ឆ្នាំសិក្សា *</label>
            <Input 
              value={currentClass.academicYear} 
              onChange={(e) => setCurrentClass({...currentClass, academicYear: e.target.value})}
              error={!!errors.academicYear}
            />
            {errors.academicYear && <p className="text-danger text-xs mt-1">{errors.academicYear}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-primary mb-1">ចំណាំ (ស្រេចចិត្ត)</label>
            <Input 
              value={currentClass.notes} 
              onChange={(e) => setCurrentClass({...currentClass, notes: e.target.value})}
              placeholder="ព័ត៌មានបន្ថែម..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-2">ភ្ជាប់ថ្នាក់សម្រាប់គិតចំណាត់ថ្នាក់រួម</label>
            <div className="bg-background-selected p-3 rounded-lg max-h-[150px] overflow-y-auto border border-border">
              {(() => {
                const getGrade = (name?: string) => name ? (name.match(/^(\d+)/)?.[1] || '') : '';
                const currentGrade = getGrade(currentClass.name);
                const eligibleClasses = classes.filter(c => c.id !== currentClass.id && (!currentGrade || getGrade(c.name) === currentGrade));
                
                if (eligibleClasses.length === 0) {
                  return <div className="text-sm text-secondary-text text-center py-2">{currentGrade ? 'មិនមានថ្នាក់កម្រិតនេះផ្សេងទៀតទេ' : 'សូមបញ្ចូលឈ្មោះថ្នាក់សិន'}</div>;
                }
                
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {eligibleClasses.map(c => (
                      <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-white rounded border border-transparent hover:border-border cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                        checked={(currentClass.linkedClassIds || []).includes(c.id)}
                        onChange={() => toggleLinkedClass(c.id)}
                      />
                      <span className="text-sm">{c.name} ({c.shift === 'Morning' ? 'ព្រឹក' : c.shift === 'Afternoon' ? 'រសៀល' : 'យប់'})</span>
                      </label>
                    ))}
                  </div>
                );
              })()}
            </div>
            <p className="text-xs text-secondary-text mt-1.5">ថ្នាក់ដែលបានភ្ជាប់គ្នានឹងត្រូវបានទាញយកសិស្សមកគិតចំណាត់ថ្នាក់ប្រកួតគ្នានៅក្នុងសៀវភៅពិន្ទុ (Gradebook)។</p>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <Button variant="secondary" onClick={() => setShowModal(false)}>បោះបង់</Button>
            <Button variant="primary" onClick={handleSave}>រក្សាទុក</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Classes;
