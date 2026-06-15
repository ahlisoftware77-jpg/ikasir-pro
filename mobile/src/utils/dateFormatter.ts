/**
 * Safely parse any date value (string, ISO string, milliseconds, Firestore Timestamp, or Date object)
 * into a valid Date object, or return null if it's invalid.
 */
export function parseDate(val: any): Date | null {
  if (!val) return null;
  
  // 1. If it's already a Date object
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  
  // 2. If it's a Firestore Timestamp (duck typing check)
  if (typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {
      console.warn("Error calling toDate on object:", e);
    }
  }
  
  // 3. If it has a seconds property (often Firestore Timestamp after JSON serialization/deserialization)
  if (typeof val.seconds === 'number') {
    const d = new Date(val.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  
  // 4. ISO string, numeric timestamp, etc.
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format date to Indonesian date string "D MMMM YYYY" (e.g. "15 Juni 2026")
 */
export function formatIndonesianDate(dateOrString: any): string {
  const date = parseDate(dateOrString);
  if (!date) return '-';
  
  const days = date.getDate();
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${days} ${monthName} ${year}`;
}

/**
 * Format date to Indonesian short date string "D MMM YYYY" (e.g. "15 Jun 2026")
 */
export function formatIndonesianDateShort(dateOrString: any): string {
  const date = parseDate(dateOrString);
  if (!date) return '-';
  
  const days = date.getDate();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${days} ${monthName} ${year}`;
}

/**
 * Format date to Indonesian day and month only "D MMM" (e.g. "15 Jun")
 */
export function formatIndonesianDayMonth(dateOrString: any): string {
  const date = parseDate(dateOrString);
  if (!date) return '-';
  
  const days = date.getDate();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  const monthName = months[date.getMonth()];
  
  return `${days} ${monthName}`;
}

/**
 * Format date to Indonesian date & time string "D MMM YYYY, HH:MM" (e.g. "15 Jun 2026, 15:09")
 */
export function formatIndonesianDateTime(dateOrString: any): string {
  const date = parseDate(dateOrString);
  if (!date) return '-';
  
  const day = date.getDate();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day} ${monthName} ${year}, ${hours}:${minutes}`;
}

/**
 * Format date to time string "HH:MM" (e.g. "15:09")
 */
export function formatIndonesianTime(dateOrString: any): string {
  const date = parseDate(dateOrString);
  if (!date) return '--:--';
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * Format date to month and year "MMMM YYYY" (e.g. "Juni 2026")
 */
export function formatIndonesianMonthYear(dateOrString: any): string {
  const date = parseDate(dateOrString);
  if (!date) return '-';
  
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${monthName} ${year}`;
}
