import * as XLSX from 'xlsx';

/**
 * Export generic array of objects to Excel
 */
export const exportToExcel = (data: any[], filename: string, sheetName: string = 'Sheet1') => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return false;
  }

  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Auto-adjust column width based on content length
    const maxWidths: { [key: string]: number } = {};
    data.forEach((row) => {
      Object.keys(row).forEach((key) => {
        const valStr = String(row[key]);
        if (!maxWidths[key] || valStr.length > maxWidths[key]) {
          maxWidths[key] = valStr.length;
        }
      });
    });

    const colWidths = Object.keys(data[0]).map(key => ({
      wch: Math.max(maxWidths[key] || 10, key.length) + 2
    }));
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return true;
  } catch (error) {
    console.error('Failed to export to Excel:', error);
    return false;
  }
};

/**
 * Import from Excel file
 */
export const importFromExcel = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Assume first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        reject(error);
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};
