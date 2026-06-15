import "./global.css";

// --- Safe Date Prototype Polyfill to prevent Hermes/Android crashes ---
const monthsLong = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const monthsShort = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

function safeFormatDate(date: Date, options?: any): string {
  if (isNaN(date.getTime())) return "Invalid Date";

  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  const showYear = options?.year !== undefined;
  const showMonth = options?.month !== undefined;
  const showDay = options?.day !== undefined;
  
  const showHour = options?.hour !== undefined;
  const showMinute = options?.minute !== undefined;
  const showSecond = options?.second !== undefined;

  let datePart = '';
  if (showDay || showMonth || showYear) {
    const dayStr = options?.day === '2-digit' ? String(day).padStart(2, '0') : String(day);
    let monthStr = '';
    if (options?.month === 'long') {
      monthStr = monthsLong[monthIndex];
    } else if (options?.month === 'short') {
      monthStr = monthsShort[monthIndex];
    } else if (options?.month === '2-digit') {
      monthStr = String(monthIndex + 1).padStart(2, '0');
    } else {
      monthStr = String(monthIndex + 1);
    }
    const yearStr = options?.year === '2-digit' ? String(year).slice(-2) : String(year);

    const parts: string[] = [];
    if (showDay) parts.push(dayStr);
    if (showMonth) parts.push(monthStr);
    if (showYear) parts.push(yearStr);
    
    if (options?.month === '2-digit' || typeof options?.month === 'undefined' || options?.month === 'numeric') {
      datePart = parts.join('/');
    } else {
      datePart = parts.join(' ');
    }
  }

  let timePart = '';
  if (showHour || showMinute || showSecond) {
    const timeParts: string[] = [];
    if (showHour) timeParts.push(hours);
    if (showMinute) timeParts.push(minutes);
    if (showSecond) timeParts.push(seconds);
    timePart = timeParts.join(':');
  }

  if (datePart && timePart) {
    return `${datePart} ${timePart}`;
  }
  
  return datePart || timePart || `${day}/${monthIndex + 1}/${year}`;
}

(Date.prototype as any).toLocaleDateString = function (locales?: any, options?: any) {
  const opt = options || { day: 'numeric', month: 'long', year: 'numeric' };
  const cleanOpt = { ...opt, hour: undefined, minute: undefined, second: undefined };
  return safeFormatDate(this, cleanOpt);
};

(Date.prototype as any).toLocaleTimeString = function (locales?: any, options?: any) {
  const opt = options || { hour: '2-digit', minute: '2-digit' };
  const cleanOpt = { ...opt, day: undefined, month: undefined, year: undefined };
  return safeFormatDate(this, cleanOpt);
};

(Date.prototype as any).toLocaleString = function (locales?: any, options?: any) {
  const opt = options || { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  return safeFormatDate(this, opt);
};

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

