import type { DayCellContentArg } from '@fullcalendar/core';
import * as holiday_jp from '@holiday-jp/holiday_jp';

interface CompanyHoliday {
  id: number;
  date: string;
  description: string;
}

export const getDayClasses = (arg: DayCellContentArg, companyHolidays: CompanyHoliday[]): string[] => {
  const classNames: string[] = [];

  // For 'today' class
  const today = new Date();
  const argDate = new Date(arg.date); // Create a new Date object from arg.date to avoid modifying the original

  // Normalize 'today' and 'argDate' to start of day in local time for accurate comparison
  today.setHours(0, 0, 0, 0);
  argDate.setHours(0, 0, 0, 0);

  if (
    today.getFullYear() === argDate.getFullYear() &&
    today.getMonth() === argDate.getMonth() &&
    today.getDate() === argDate.getDate()
  ) {
    classNames.push('today');
  }

  // For 'company-holiday' class
  // Format arg.date to YYYY-MM-DD string using local date components
  const argYear = arg.date.getFullYear();
  const argMonth = (arg.date.getMonth() + 1).toString().padStart(2, '0'); // getMonth is 0-indexed
  const argDay = arg.date.getDate().toString().padStart(2, '0');
  const argDateLocalFormatted = `${argYear}-${argMonth}-${argDay}`;

  if (companyHolidays.some(h => h.date === argDateLocalFormatted)) {
    classNames.push('company-holiday');
  }

  // For 'holiday', 'sunday', 'saturday' classes
  if (holiday_jp.isHoliday(arg.date)) { // holiday_jp handles its own date logic
    classNames.push('holiday');
  } else {
    const day = arg.date.getDay();
    if (day === 0) classNames.push('sunday');
    if (day === 6) classNames.push('saturday');
  }
  return classNames;
};

