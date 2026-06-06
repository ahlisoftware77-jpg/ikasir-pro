import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  if (!data || data.length === 0) {
    alert('Tidak ada data yang bisa diekspor.');
    return;
  }
  
  // Format the data and create worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  
  // Auto-size columns roughly based on content
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(
      key.length,
      ...data.map(row => (row[key] ? row[key].toString().length : 0))
    ) + 2
  }));
  worksheet['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Download the file
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
