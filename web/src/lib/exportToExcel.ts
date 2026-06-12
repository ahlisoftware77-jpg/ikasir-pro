// @ts-ignore
import XLSX from 'xlsx-js-style';

export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  if (!data || data.length === 0) {
    alert('Tidak ada data yang bisa diekspor.');
    return;
  }
  
  // 1. Identify numeric columns and compute totals
  const keys = Object.keys(data[0] || {});
  const totals: any = {};
  
  // Initialize total row
  keys.forEach((key, index) => {
    if (index === 0) {
      totals[key] = 'TOTAL';
    } else {
      totals[key] = '';
    }
  });

  // Calculate sum for numeric columns
  keys.forEach((key, index) => {
    if (index === 0) return;
    
    let isNumeric = true;
    let sum = 0;
    let hasValue = false;
    
    for (const row of data) {
      const val = row[key];
      if (val !== undefined && val !== null && val !== '') {
        if (typeof val === 'number') {
          sum += val;
          hasValue = true;
        } else {
          isNumeric = false;
          break;
        }
      }
    }
    
    if (isNumeric && hasValue) {
      totals[key] = sum;
    }
  });

  // 2. Append the total row to a data copy
  const dataWithTotal = [...data, totals];

  // 3. Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(dataWithTotal);
  const workbook = XLSX.utils.book_new();

  // 4. Style the total row and headers as Bold
  const totalRowIndex = data.length + 1; // 0-indexed row for totals (header is 0, data is 1..data.length, total is data.length+1)
  
  // Apply bold style to header (row 0) and total row
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[cellRef]) continue;
      
      // If header row or total row
      if (R === 0 || R === totalRowIndex) {
        worksheet[cellRef].s = {
          font: {
            bold: true,
            sz: 11,
            name: 'Calibri'
          }
        };
      }
    }
  }

  // 5. Auto-size columns roughly based on content
  const colWidths = keys.map(key => ({
    wch: Math.max(
      key.length,
      ...dataWithTotal.map(row => (row[key] ? row[key].toString().length : 0))
    ) + 2
  }));
  worksheet['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // 6. Download the file
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
