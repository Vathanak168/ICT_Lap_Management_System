const fs = require('fs');
const file = 'src/pages/SeatingPlan.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
`export interface GridCell {
  id: string;
  type: 'empty' | 'student' | 'teacher';
  pcNumber?: string;
}`,
`export interface GridCell {
  id: string;
  type: 'empty' | 'student' | 'teacher';
  pcNumber?: string;
  studentId?: string;
  password?: string;
}`
);

content = content.replace(
`    // Check and fix orphaned students (ghost assignments)
    const validPcNumbers = new Set<string>();
    gridLayout.forEach(row => {
      row.forEach(cell => {
        if (cell.type === 'student' && cell.pcNumber) {
          validPcNumbers.add(cell.pcNumber);
        }
      });
    });

    const tx = db.transaction('students', 'readwrite');
    let hasOrphans = false;
    for (let student of students) {
      if (student.pcNumber && !validPcNumbers.has(student.pcNumber)) {
        student.pcNumber = undefined;
        student.password = undefined;
        await tx.store.put(student);
        hasOrphans = true;
      }
    }
    await tx.done;

    const newPlan: any = {
      id: activePlanId || Date.now().toString(),
      classId: selectedClass,
      shift: currentClass?.shift || '',
      academicYear: activeYear!,
      rows: gridRows,
      cols: gridCols,
      gridLayout: gridLayout,
      createdAt: new Date().toISOString()
    };

    await db.put('seatingPlans', newPlan);
    setActivePlanId(newPlan.id);
    setIsEditMode(false);
    
    if (hasOrphans) {
      loadData();
    }`,
`    const newPlan: any = {
      id: activePlanId || Date.now().toString(),
      classId: selectedClass,
      shift: currentClass?.shift || '',
      academicYear: activeYear!,
      rows: gridRows,
      cols: gridCols,
      gridLayout: gridLayout,
      createdAt: new Date().toISOString()
    };

    await db.put('seatingPlans', newPlan);
    setActivePlanId(newPlan.id);
    setIsEditMode(false);`
);

content = content.replace(
`  const handleAssignStudent = async (studentId: string) => {
    const pcNumber = selectedCell?.pcNumber;
    if (!pcNumber) return;
    
    const student = students.find(s => s.id === studentId);
    if (student) {
      const updatedStudent = { ...student, pcNumber };
      const db = await initDB();
      await db.put('students', updatedStudent);
      loadData();
    }
  };`,
`  const handleAssignStudent = (studentId: string) => {
    if (!selectedCell) return;
    
    setGridLayout(prev => prev.map(row => row.map(cell => {
      if (cell.id === selectedCell.id) {
        return { ...cell, studentId };
      }
      return cell;
    })));
    setIsModalOpen(false);
  };`
);

content = content.replace(
`      } else {
        newCell.type = 'empty';
        newCell.pcNumber = undefined;
      }`,
`      } else {
        newCell.type = 'empty';
        newCell.pcNumber = undefined;
        newCell.studentId = undefined;
        newCell.password = undefined;
      }`
);

content = content.replace(
`  const handleGeneratePasswords = async () => {
    const existingPasswords = new Set<string>();
    students.forEach(s => {
      if (s.password) existingPasswords.add(s.password);
    });

    const db = await initDB();
    const tx = db.transaction('students', 'readwrite');
    const promises = [];

    students.forEach(student => {
      if (student.pcNumber) {
        student.password = generateUniquePassword(existingPasswords);
        existingPasswords.add(student.password);
        promises.push(tx.store.put(student));
      }
    });
    
    await Promise.all(promises);
    await tx.done;
    
    alert(language === 'KH' ? 'បង្កើតកូដជោគជ័យ!' : 'Passwords generated successfully!');
    loadData();
  };`,
`  const handleGeneratePasswords = () => {
    const existingPasswords = new Set<string>();
    gridLayout.forEach(row => row.forEach(cell => {
      if (cell.password) existingPasswords.add(cell.password);
    }));

    setGridLayout(prev => prev.map(row => row.map(cell => {
      if (cell.type === 'student' && cell.studentId) {
        const password = generateUniquePassword(existingPasswords);
        existingPasswords.add(password);
        return { ...cell, password };
      }
      return cell;
    })));
    
    alert(language === 'KH' ? 'បង្កើតកូដជោគជ័យ! សូមចុចរក្សាទុកប្លង់តុដើម្បីរក្សាទុក។' : 'Passwords generated! Please save the layout to persist.');
  };`
);

content = content.replace(
`  const handleClearAllAssignments = async () => {
    if (confirm(language === 'KH' ? 'តើអ្នកពិតជាចង់ដកសិស្សទាំងអស់ចេញពីតុពិតមែនទេ?' : 'Are you sure you want to clear all assignments?')) {
      const db = await initDB();
      const tx = db.transaction('students', 'readwrite');
      const promises = [];

      students.forEach(student => {
        if (student.pcNumber || student.password) {
          student.pcNumber = undefined;
          student.password = undefined;
          promises.push(tx.store.put(student));
        }
      });
      
      await Promise.all(promises);
      await tx.done;
      loadData();
    }
  };`,
`  const handleClearAllAssignments = () => {
    if (confirm(language === 'KH' ? 'តើអ្នកពិតជាចង់ដកសិស្សទាំងអស់ចេញពីតុពិតមែនទេ?' : 'Are you sure you want to clear all assignments?')) {
      setGridLayout(prev => prev.map(row => row.map(cell => {
        if (cell.type === 'student') {
          return { ...cell, studentId: undefined, password: undefined };
        }
        return cell;
      })));
    }
  };`
);

content = content.replace(
`  const handleAutoAssign = async () => {
    const unassignedStudents = students.filter(s => !s.pcNumber).sort((a, b) => a.studentId.localeCompare(b.studentId));
    
    const availablePCs: string[] = [];
    gridLayout.forEach(row => {
      row.forEach(cell => {
        if (cell.type === 'student' && cell.pcNumber && !students.some(s => s.pcNumber === cell.pcNumber)) {
          availablePCs.push(cell.pcNumber);
        }
      });
    });

    if (unassignedStudents.length === 0) {
      alert(language === 'KH' ? 'មិនមានសិស្សដែលនៅទំនេរទេ' : 'No unassigned students');
      return;
    }

    if (availablePCs.length === 0) {
      alert(language === 'KH' ? 'មិនមានកុំព្យូទ័រដែលនៅទំនេរទេ' : 'No available PCs');
      return;
    }

    const db = await initDB();
    const tx = db.transaction('students', 'readwrite');
    let assignedCount = 0;

    const promises = [];
    for (let i = 0; i < unassignedStudents.length; i++) {
      if (i < availablePCs.length) {
        const student = unassignedStudents[i];
        student.pcNumber = availablePCs[i];
        promises.push(tx.store.put(student));
        assignedCount++;
      }
    }
    
    await Promise.all(promises);
    await tx.done;
    
    alert(language === 'KH' ? \`បានរៀបចំសិស្សចំនួន \${assignedCount} នាក់ដោយស្វ័យប្រវត្តិជោគជ័យ!\` : \`Successfully auto-assigned \${assignedCount} students!\`);
    loadData();
  };`,
`  const handleAutoAssign = () => {
    const assignedStudentIds = new Set<string>();
    const availableCells: {r: number, c: number}[] = [];
    
    gridLayout.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.type === 'student') {
          if (cell.studentId) assignedStudentIds.add(cell.studentId);
          else if (cell.pcNumber) availableCells.push({r, c});
        }
      });
    });
    
    const unassignedStudents = students.filter(s => !assignedStudentIds.has(s.id)).sort((a, b) => a.studentId.localeCompare(b.studentId));
    
    if (unassignedStudents.length === 0) {
      alert(language === 'KH' ? 'មិនមានសិស្សដែលនៅទំនេរទេ' : 'No unassigned students');
      return;
    }

    if (availableCells.length === 0) {
      alert(language === 'KH' ? 'មិនមានកុំព្យូទ័រដែលនៅទំនេរទេ' : 'No available PCs');
      return;
    }

    let assignedCount = 0;
    setGridLayout(prev => {
      const newLayout = prev.map(row => row.map(cell => ({...cell})));
      let studentIdx = 0;
      for (const {r, c} of availableCells) {
        if (studentIdx < unassignedStudents.length) {
          newLayout[r][c].studentId = unassignedStudents[studentIdx].id;
          studentIdx++;
          assignedCount++;
        }
      }
      return newLayout;
    });
    
    alert(language === 'KH' ? \`បានរៀបចំសិស្សចំនួន \${assignedCount} នាក់ដោយស្វ័យប្រវត្តិជោគជ័យ! សូមរក្សាទុកប្លង់តុដើម្បីរក្សាទុកទិន្នន័យ។\` : \`Successfully auto-assigned \${assignedCount} students! Please save to continue.\`);
  };`
);

content = content.replace(
`  const handleUnassignStudent = async () => {
    if (!selectedCell) return;
    
    const student = students.find(s => s.pcNumber === selectedCell.pcNumber);
    if (student) {
      const db = await initDB();
      const updatedStudent = { ...student, pcNumber: undefined, password: undefined };
      await db.put('students', updatedStudent);
      loadData();
      setIsModalOpen(false);
    }
  };`,
`  const handleUnassignStudent = () => {
    if (!selectedCell) return;
    setGridLayout(prev => prev.map(row => row.map(cell => {
      if (cell.id === selectedCell.id) {
        return { ...cell, studentId: undefined, password: undefined };
      }
      return cell;
    })));
    setIsModalOpen(false);
  };`
);

content = content.replace(
`  const activeStudentCount = students.filter(s => s.pcNumber).length;
  const unassignedStudentsList = students.filter(s => !s.pcNumber).sort((a, b) => a.studentId.localeCompare(b.studentId));`,
`  const assignedStudentIds = new Set<string>();
  gridLayout.forEach(row => row.forEach(cell => { if (cell.studentId) assignedStudentIds.add(cell.studentId); }));
  
  const activeStudentCount = assignedStudentIds.size;
  const unassignedStudentsList = students.filter(s => !assignedStudentIds.has(s.id)).sort((a, b) => a.studentId.localeCompare(b.studentId));`
);

content = content.replace(
`                      const student = students.find(s => s.pcNumber === cell.pcNumber);`,
`                      const student = cell.studentId ? students.find(s => s.id === cell.studentId) : null;`
);

content = content.replace(
`                        {student && showPasswords && student.password && (
                          <div className="mt-0.5 text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm border border-emerald-200">
                            PWD: {student.password}
                          </div>
                        )}`,
`                        {student && showPasswords && cell.password && (
                          <div className="mt-0.5 text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm border border-emerald-200">
                            PWD: {cell.password}
                          </div>
                        )}`
);

fs.writeFileSync(file, content);
console.log('Replacements complete.');
