import type { DayCellContentArg } from '@fullcalendar/core';
import * as holiday_jp from '@holiday-jp/holiday_jp';

interface CompanyHoliday {
  id: number;
  date: string;
  description: string;
}

export const getDayClasses = (arg: DayCellContentArg, companyHolidays: CompanyHoliday[]): string[] => {
  const classNames: string[] = [];
  const today = new Date();
  const date = arg.date;

  if (
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate()
  ) {
    classNames.push('today');
  }

  const dateString = date.toISOString().split('T')[0];
  if (companyHolidays.some(h => h.date === dateString)) {
    classNames.push('company-holiday');
  }

  if (holiday_jp.isHoliday(arg.date)) {
    classNames.push('holiday');
  } else {
    const day = arg.date.getDay();
    if (day === 0) classNames.push('sunday');
    if (day === 6) classNames.push('saturday');
  }
  return classNames;
};

