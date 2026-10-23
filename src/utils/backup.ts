import { initDB } from '../store/db';
import { getLocalDate } from './date';

export const exportDatabase = async (academicYear?: string) => {
  try {
    const db = await initDB();
    const data: any = {};
    
    // Get all data from all object stores, scoped to academic year only if supported
    for (const storeName of db.objectStoreNames) {
      const yearFilter = (academicYear && db.supportsAcademicYear(storeName)) ? academicYear : undefined;
      data[storeName] = await db.getAll(storeName, yearFilter);
    }
    
    // Convert to JSON string
    const jsonStr = JSON.stringify(data, null, 2);
    
    // Create a blob and trigger download
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ict_lab_backup_${getLocalDate()}.json`;
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
        
        // Loop through keys and store data using chunked putMany
        for (const key of Object.keys(data)) {
          if (db.objectStoreNames.contains(key) && Array.isArray(data[key]) && data[key].length > 0) {
            await db.putMany(key, data[key]);
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

export const clearDatabase = async (academicYear?: string): Promise<boolean> => {
  try {
    const db = await initDB();
    // Safely clear user data stores, preserving configuration stores like settings and aiHistory
    const userStores = db.objectStoreNames.filter(
      (name) => name !== 'settings' && name !== 'aiHistory'
    );

    for (const storeName of userStores) {
      const yearFilter = (academicYear && db.supportsAcademicYear(storeName)) ? academicYear : undefined;
      const records = await db.getAll(storeName, yearFilter);
      const ids = records.map((item: any) => item?.id).filter(Boolean);
      if (ids.length > 0) {
        await db.deleteMany(storeName, ids);
      }
    }
    return true;
  } catch (error) {
    console.error('Failed to clear database:', error);
    return false;
  }
};
