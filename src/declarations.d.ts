declare module 'japanese-holidays' {
  /**
   * 指定された日が休日かどうかを判定して、休日ならその名前を返します。
   * @param date 判定する日付
   * @param furikae 振替休日を含めるかどうか (default: true)
   * @returns 休日名、または休日でなければ undefined
   */
  export function isHoliday(date: Date, furikae?: boolean): string | undefined;

  /**
   * 指定された年の休日を配列にして返します。
   * @param year 年
   * @param furikae 振替休日を含めるかどうか (default: true)
   */
  export function getHolidaysOf(year: number, furikae?: boolean): { month: number; date: number; name: string }[];

  export function isHolidayAt(date: Date, furikae?: boolean): string | undefined;
}