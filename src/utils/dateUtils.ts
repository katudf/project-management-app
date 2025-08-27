export const formatDate = (date: string | Date): string => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    // タイムゾーンオフセットを考慮しないようにUTCベースでフォーマット
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

export const getDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    // JSTの0時として解釈させるため、タイムゾーン情報を付加
    const startDate = new Date(`${start}T00:00:00+09:00`);
    const endDate = new Date(`${end}T00:00:00+09:00`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

    // getTime()はUTCのミリ秒なので、タイムゾーンの影響を受けずに差を計算できる
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    return diffDays + 1;
};