// カレンダー関連型定義

export interface Resource {
  id: string;
  title: string;
  group: 'projects' | 'workers';
  display_order?: number;
  parentId?: string;
  extendedProps?: any;
}

export interface CalendarEvent {
  id: string;
  resourceId: string;
  title: string;
  start: string;
  end?: string;
  className?: string;
  editable?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  display?: string;
  extendedProps?: any;
}

export interface ProjectData {
  id: number;
  name: string;
  order: number;
  startDate: string;
  endDate: string;
  bar_color?: string;
}

export interface WorkerData {
  id: number;
  name: string;
  order: number;
}

export interface AssignmentData {
  id: number;
  projectId: number | null;
  workerId: number;
  date: string;
  title: string | null;
  assignment_order: number;
}