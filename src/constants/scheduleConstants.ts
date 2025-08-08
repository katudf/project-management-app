export const RESOURCE_PREFIX = {
  PROJECT: 'proj_',
  TASK: 'task_',
  WORKER: 'work_',
  PROJECT_MAIN: 'proj-main_',
  TASK_BAR: 'task-bar_',
} as const;

export const EVENT_CLASS_NAME = {
  ASSIGNMENT: 'assignment-event',
  PROJECT_MAIN: 'project-main-event',
  TASK: 'task-event',
  // ... 他のクラス名も必要に応じて追加
} as const;