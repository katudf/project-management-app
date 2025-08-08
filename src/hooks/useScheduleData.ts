// src/hooks/useScheduleData.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabaseClient';
import type { CalendarEvent, Resource } from '@/types/schedule';
import { RESOURCE_PREFIX, EVENT_CLASS_NAME } from '@/constants/scheduleConstants';
import { getDuration, formatDate } from '@/utils/dateUtils';

/**
 * スケジュール、リソース、イベントに関するデータを取得し、整形するカスタムフック
 */
export const useScheduleData = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 必要なデータを並行して取得
      const [
        { data: projectsData, error: projectsError },
        { data: tasksData, error: tasksError },
        { data: workersData, error: workersError },
        { data: assignmentsData, error: assignmentsError },
      ] = await Promise.all([
        supabase.from('Projects').select('*').order('order', { ascending: true }),
        supabase.from('ProjectTasks').select('*, ServiceMaster(name)').order('order', { ascending: true }), // ServiceMasterのnameを結合して取得
        supabase.from('Workers').select('*').order('order', { ascending: true }),
        supabase.from('Assignments').select('*').order('assignment_order', { ascending: true }),
      ]);

      // エラーハンドリング
      if (projectsError) throw new Error(`Projectsの取得に失敗: ${projectsError.message}`);
      if (tasksError) throw new Error(`ProjectTasksの取得に失敗: ${tasksError.message}`);
      if (workersError) throw new Error(`Workersの取得に失敗: ${workersError.message}`);
      if (assignmentsError) throw new Error(`Assignmentsの取得に失敗: ${assignmentsError.message}`);

      // --- 1. カレンダーのリソースを構築 ---
      const projectResources: Resource[] = projectsData.map(project => ({
        id: `${RESOURCE_PREFIX.PROJECT}${project.id}`,
        group: '案件一覧',
        title: project.name,
        order: project.order,
      }));

      const taskResources: Resource[] = tasksData.map(task => ({
        id: `${RESOURCE_PREFIX.TASK}${task.id}`,
        parentId: `${RESOURCE_PREFIX.PROJECT}${task.projectId}`,
        group: '案件一覧',
        title: task.ServiceMaster.name, // 結合したテーブルからnameを取得
        order: task.order,
      }));

      const workerResources: Resource[] = workersData.map(worker => ({
        id: `${RESOURCE_PREFIX.WORKER}${worker.id}`,
        group: '作業員一覧',
        title: worker.name,
        order: worker.order,
      }));

      const allResources: Resource[] = [
        ...projectResources,
        ...taskResources,
        ...workerResources,
      ];
      setResources(allResources);

      // --- 2. カレンダーのイベントを構築 ---
      const projectEvents: CalendarEvent[] = projectsData.map(project => {
        const duration = getDuration(project.startDate, project.endDate);
        const endDate = project.endDate ? new Date(new Date(project.endDate).getTime() + 86400000).toISOString().split('T')[0] : project.startDate;
        const displayEndDate = project.endDate ? new Date(project.endDate) : new Date(project.startDate);

        return {
          id: `${RESOURCE_PREFIX.PROJECT_MAIN}${project.id}`,
          resourceId: `${RESOURCE_PREFIX.PROJECT}${project.id}`,
          title: `${project.name} (${formatDate(project.startDate)}～${formatDate(displayEndDate.toISOString().split('T')[0])} ${duration}日間)`,
          start: project.startDate,
          end: endDate,
          className: EVENT_CLASS_NAME.PROJECT_MAIN,
          editable: true,
        };
      });

      const taskEvents: CalendarEvent[] = tasksData.map(task => {
        const project = projectsData.find(p => p.id === task.projectId);
        if (!project) return null; // プロジェクトが見つからない場合はスキップ

        const projectStartDate = new Date(project.startDate);
        const projectEndDate = project.endDate ? new Date(project.endDate) : projectStartDate; // プロジェクト終了日がない場合は開始日を使用

        let taskStart = new Date(task.startDate);
        let taskEnd = task.endDate ? new Date(task.endDate) : taskStart; // タスク終了日がない場合は開始日を使用

        // タスクの開始日をプロジェクトの開始日より前にしない
        if (taskStart < projectStartDate) {
          taskStart = projectStartDate;
        }
        // タスクの終了日をプロジェクトの終了日より後にしない
        if (taskEnd > projectEndDate) {
          taskEnd = projectEndDate;
        }
        // タスクの開始日が終了日より後になった場合、開始日を終了日に合わせる
        if (taskStart > taskEnd) {
          taskStart = taskEnd;
        }

        const endDate = new Date(taskEnd.getTime() + 86400000).toISOString().split('T')[0];

        return {
          id: `${RESOURCE_PREFIX.TASK_BAR}${task.id}`,
          resourceId: `${RESOURCE_PREFIX.TASK}${task.id}`,
          title: task.ServiceMaster.name, // 結合したテーブルからnameを取得
          start: taskStart.toISOString().split('T')[0],
          end: endDate,
          className: EVENT_CLASS_NAME.TASK,
          editable: true,
        };
      }).filter(Boolean) as CalendarEvent[]; // nullを除外

      const assignmentEvents: CalendarEvent[] = assignmentsData.map(assignment => {
        const project = projectsData.find(p => p.id == assignment.projectId);
        return {
          id: `assign_${assignment.id}`,
          resourceId: `${RESOURCE_PREFIX.WORKER}${assignment.workerId}`,
          title: assignment.title || (project ? project.name : '不明な予定'),
          start: assignment.date,
          className: EVENT_CLASS_NAME.ASSIGNMENT,
          extendedProps: { assignment_order: assignment.assignment_order },
        };
      });

      const allEvents = [...projectEvents, ...taskEvents, ...assignmentEvents];
      setEvents(allEvents);

    } catch (e: any) {
      console.error("データ取得中にエラーが発生しました:", e);
      setError(e.message || '不明なエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { resources, events, setEvents, loading, error, fetchData };
};