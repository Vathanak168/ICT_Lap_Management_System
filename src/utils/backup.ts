import { initDB } from '../store/db';

export const exportDatabase = async (academicYear?: string) => {
  try {
    const db = await initDB();
    const data: any = {};
    
    // Get all data from all object stores, scoped to academic year if provided
    for (const storeName of db.objectStoreNames) {
      data[storeName] = await db.getAll(storeName, academicYear);
    }
    
    // Convert to JSON string
    const jsonStr = JSON.stringify(data, null, 2);
    
    // Create a blob and trigger download
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ict_lab_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Failed to export database:', error);
    return false;
  }
};

export const importDatabase = async (file: File): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        const db = await initDB();
        
        // Loop through keys and store data
        for (const key of Object.keys(data)) {
          const storeName = key as "classes" | "students" | "attendance" | "pcIssues" | "grades" | "lessonLogs";
          if (db.objectStoreNames.contains(storeName)) {
            const tx = db.transaction(storeName, 'readwrite');
            
            // Optional: Clear existing data before import, or just merge
            // await tx.store.clear();
            
            for (const item of data[storeName]) {
              await tx.store.put(item);
            }
            await tx.done;
          }
        }
        
        resolve(true);
      } catch (error) {
        console.error('Failed to parse or import backup file:', error);
        reject(false);
      }
    };
    
    reader.onerror = () => reject(false);
    reader.readAsText(file);
  });
};

export const clearDatabase = async () => {
  try {
    const db = await initDB();
    for (const storeName of db.objectStoreNames) {
      const tx = db.transaction(storeName, 'readwrite');
      await tx.store.clear();
      await tx.done;
    }
    return true;
  } catch (error) {
    console.error('Failed to clear database:', error);
    return false;
  }
};
