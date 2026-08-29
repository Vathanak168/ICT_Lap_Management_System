import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Users, BookOpen } from 'lucide-react';
import { initDB } from '../store/db';
import type { ClassRecord } from '../store/db';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useAcademicYear } from '../contexts/AcademicYearContext';

const Classes = () => {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { activeYear } = useAcademicYear();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [currentClass, setCurrentClass] = useState<Partial<ClassRecord>>({
    name: '', shift: 'Morning', academicYear: activeYear || '', notes: '', linkedClassIds: []
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const loadRequestRef = useRef(0);

  const loadClasses = async (targetYear: string) => {
    if (!targetYear) return;
    
    setIsLoading(true);
    const requestId = ++loadRequestRef.current;
    
    try {
      const db = await initDB();
      const allClasses = await db.getAll('classes', targetYear);
      
      if (requestId !== loadRequestRef.current) return;
      allClasses.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      setClasses(allClasses);
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        console.error('Failed to load classes:', error);
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (activeYear) {
      void loadClasses(activeYear);
    } else {
      setClasses([]);
    }
  }, [activeYear]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!currentClass.name) {
      newErrors.name = 'សូមបញ្ចូលឈ្មោះថ្នាក់';
    } else {
      const duplicate = classes.find(c => 
        c.id !== currentClass.id && 
        c.name === currentClass.name && 
        c.shift === currentClass.shift
      );
      if (duplicate) {
        newErrors.name = `ថ្នាក់ "${currentClass.name}" វេន${currentClass.shift === 'Morning' ? 'ព្រឹក' : currentClass.shift === 'Afternoon' ? 'រសៀល' : 'យប់'} មានរួចហើយ`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!activeYear) {
      alert('សូមជ្រើសរើសឆ្នាំសិក្សាជាមុនសិន');
      return;
    }
    
    // Lock the current year for this save operation
    const targetYear = activeYear;

    setIsSaving(true);
    try {
      const db = await initDB();
      
      const id = currentClass.id || crypto.randomUUID();
      const newClass: ClassRecord = {
        id,
        name: currentClass.name!,
        shift: currentClass.shift as 'Morning' | 'Afternoon' | 'Evening',
        academicYear: targetYear, 
        notes: currentClass.notes || '',
        linkedClassIds: currentClass.linkedClassIds || []
      };

      // Ensure symmetrical links
      // 1. Fetch all classes in this year to see who currently links to us
      const allClasses = await db.getAll('classes', targetYear);
      
      const updatePromises: Promise<void>[] = [];
      
      // Update other classes
      allClasses.forEach(otherClass => {
        if (otherClass.id === id) return;
        
        const otherLinks = otherClass.linkedClassIds || [];
        const isLinkedToUs = otherLinks.includes(id);
        const shouldBeLinked = newClass.linkedClassIds?.includes(otherClass.id) || false;
        
        if (shouldBeLinked && !isLinkedToUs) {
          // Add link symmetrically
          updatePromises.push(
            db.update('classes', otherClass.id, {
              linkedClassIds: [...otherLinks, id]
            })
          );
        } else if (!shouldBeLinked && isLinkedToUs) {
          // Remove link symmetrically
          updatePromises.push(
            db.update('classes', otherClass.id, {
              linkedClassIds: otherLinks.filter(link => link !== id)
            })
          );
        }
      });

      // Save our class
      updatePromises.push(db.put('classes', newClass));

      if (currentClass.id) {
        // If editing existing class, check if shift changed
        const oldClass = classes.find(c => c.id === currentClass.id);
        if (oldClass && oldClass.shift !== newClass.shift) {
          const classStudents = await db.getAll('students', targetYear);
          const affectedStudents = classStudents.filter(s => s.class === currentClass.id);
          for (const student of affectedStudents) {
            updatePromises.push(db.update('students', student.id, { shift: newClass.shift }));
          }

          // Sync shift to other tables that store it
          const [allAttendance, allGrades, allSeating, allLogs] = await Promise.all([
            db.getAll('attendance', targetYear),
            db.getAll('grades', targetYear),
            db.getAll('seatingPlans', targetYear),
            db.getAll('lessonLogs', targetYear)
          ]);

          allAttendance.filter(a => a.classId === currentClass.id).forEach(a => {
            updatePromises.push(db.update('attendance', a.id, { shift: newClass.shift }));
          });
          allGrades.filter(g => g.classId === currentClass.id).forEach(g => {
            updatePromises.push(db.update('grades', g.id, { shift: newClass.shift }));
          });
          allSeating.filter(s => s.classId === currentClass.id).forEach(s => {
            updatePromises.push(db.update('seatingPlans', s.id, { shift: newClass.shift }));
          });
          allLogs.filter(l => l.classId === currentClass.id || l.class === currentClass.id).forEach(l => {
            updatePromises.push(db.update('lessonLogs', l.id, { shift: newClass.shift }));
          });
        }
      }

      // Execute all updates concurrently
      await Promise.all(updatePromises);

      setShowModal(false);
      await loadClasses(targetYear);
    } catch (error) {
      console.error(error);
      alert('មានបញ្ហាក្នុងការរក្សាទុកថ្នាក់');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (classId: string) => {
    if (!activeYear) return;
    const targetYear = activeYear;

    if (window.confirm('តើអ្នកពិតជាចង់លុបថ្នាក់នេះមែនទេ? សិស្ស និងទិន្នន័យពាក់ព័ន្ធទាំងអស់ (វត្តមាន ពិន្ទុ កាលវិភាគ...) នឹងត្រូវលុបចោលទាំងស្រុងដោយមិនអាចទាញមកវិញបានទេ!')) {
      setIsSaving(true);
      try {
        const db = await initDB();
        
        // 1. Fetch all dependent records
        const [
          allStudents,
          allAttendance,
          allGrades,
          allSeating,
          allLessonLogs,
          allLessonPlans,
          allClasses
        ] = await Promise.all([
          db.getAll('students', targetYear),
          db.getAll('attendance', targetYear),
          db.getAll('grades', targetYear),
          db.getAll('seatingPlans', targetYear),
          db.getAll('lessonLogs', targetYear),
          db.getAll('lessonPlans', targetYear),
          db.getAll('classes', targetYear)
        ]);
        
        // Filter those belonging to this class
        const studentIds = allStudents.filter(s => s.class === classId).map(s => s.id);
        const attendanceIds = allAttendance.filter(a => a.classId === classId).map(a => a.id);
        const gradeIds = allGrades.filter(g => g.classId === classId).map(g => g.id);
        const seatingIds = allSeating.filter(s => s.classId === classId).map(s => s.id);
        
        // Note: lessonLog uses classId or class depending on the data structure, check both
        const logIds = allLessonLogs.filter(l => l.classId === classId || l.class === classId).map(l => l.id);
        const planIds = allLessonPlans.filter(p => p.classId === classId).map(p => p.id);
        
        // Prepare promises for bulk deletion
        const deletePromises: Promise<void>[] = [];
        
        if (studentIds.length > 0) deletePromises.push(db.deleteMany('students', studentIds));
        if (attendanceIds.length > 0) deletePromises.push(db.deleteMany('attendance', attendanceIds));
        if (gradeIds.length > 0) deletePromises.push(db.deleteMany('grades', gradeIds));
        if (seatingIds.length > 0) deletePromises.push(db.deleteMany('seatingPlans', seatingIds));
        if (logIds.length > 0) deletePromises.push(db.deleteMany('lessonLogs', logIds));
        if (planIds.length > 0) deletePromises.push(db.deleteMany('lessonPlans', planIds));
        
        // Clean up linkedClassIds in other classes that reference this deleted class
        allClasses.forEach(c => {
          if (c.id !== classId && c.linkedClassIds?.includes(classId)) {
            const newLinks = c.linkedClassIds.filter(id => id !== classId);
            deletePromises.push(db.update('classes', c.id, { linkedClassIds: newLinks }));
          }
        });
        
        // Finally, delete the class itself
        deletePromises.push(db.delete('classes', classId));

        // Execute all deletes concurrently
        await Promise.all(deletePromises);
        
        await loadClasses(targetYear);
      } catch (error) {
        console.error(error);
        alert('បរាជ័យក្នុងការលុបថ្នាក់');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const openEditModal = (c: ClassRecord) => {
    setErrors({});
    setCurrentClass(c);
    setShowModal(true);
  };
  
  const openAddModal = () => {
    setErrors({});
    setCurrentClass({ name: '', shift: 'Morning', academicYear: activeYear || '', notes: '', linkedClassIds: [] });
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

  const filteredClasses = classes.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
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
              <div className="w-full min-w-[200px] bg-gray-100 border border-gray-300 text-gray-600 font-medium text-sm rounded-sm px-3 py-2">
                {activeYear || 'គ្មានឆ្នាំសិក្សា'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <button 
              className="bg-[#48b5c9] hover:bg-[#3aa3b7] hover:shadow-md text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-all border border-transparent disabled:opacity-50" 
              onClick={openAddModal}
              disabled={isLoading || isSaving || !activeYear}
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
        
        {isLoading && !isSaving ? (
          <div className="flex items-center justify-center p-12 text-secondary-text">
            កំពុងទាញយកទិន្នន័យ...
          </div>
        ) : (
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
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-sm transition-colors disabled:opacity-50"
                          title="កែប្រែ"
                          disabled={isSaving}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors disabled:opacity-50"
                          title="លុបថ្នាក់"
                          disabled={isSaving}
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
        )}
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
              disabled={isSaving}
            />
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-primary mb-1">វេនសិក្សា *</label>
            <select 
              className="block w-full rounded-lg border-border focus:border-primary focus:ring-primary sm:text-sm py-2 px-3 border bg-white disabled:opacity-50"
              value={currentClass.shift}
              onChange={(e) => setCurrentClass({...currentClass, shift: e.target.value as any})}
              disabled={isSaving}
            >
              <option value="Morning">ព្រឹក</option>
              <option value="Afternoon">រសៀល</option>
              <option value="Evening">យប់</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-primary mb-1">ឆ្នាំសិក្សា *</label>
            <Input 
              value={activeYear || ''} 
              disabled={true}
              className="bg-gray-100 cursor-not-allowed"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-primary mb-1">ចំណាំ (ស្រេចចិត្ត)</label>
            <Input 
              value={currentClass.notes} 
              onChange={(e) => setCurrentClass({...currentClass, notes: e.target.value})}
              placeholder="ព័ត៌មានបន្ថែម..."
              disabled={isSaving}
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
                        disabled={isSaving}
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
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={isSaving}>បោះបង់</Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Classes;
