// src/hooks/useScheduleData.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabaseClient';
import type { CalendarEvent, Resource } from '@/types/schedule';
import { RESOURCE_PREFIX, EVENT_CLASS_NAME } from '@/constants/scheduleConstants';
import { getDuration, formatDate, calculateAge } from '@/utils/dateUtils';

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
      // 必要なデータを並列取得
      const [
        { data: projectsData, error: projectsError },
        { data: workersData, error: workersError },
        { data: assignmentsData, error: assignmentsError },
      ] = await Promise.all([
        supabase.from('Projects').select('*').order('display_order', { ascending: true }),
        supabase.from('Workers').select('*').order('display_order', { ascending: true }),
        supabase.from('Assignments').select('*').order('assignment_order', { ascending: true }),
      ]);

      if (projectsError) throw new Error(`Projects取得失敗: ${projectsError.message}`);
      if (workersError) throw new Error(`Workers取得失敗: ${workersError.message}`);
      if (assignmentsError) throw new Error(`Assignments取得失敗: ${assignmentsError.message}`);

      // リソース構築
      const projectResources: Resource[] = projectsData.map(project => ({
        id: `${RESOURCE_PREFIX.PROJECT}${project.id}`,
        group: 'projects',
        title: project.name,
        order: project.display_order,
      }));
      const workerResources: Resource[] = workersData.map(worker => ({
        id: `${RESOURCE_PREFIX.WORKER}${worker.id}`,
        group: 'workers',
        title: worker.name,
        order: worker.display_order,
        extendedProps: {
          birthDate: worker.birthDate,
          age: worker.birthDate ? calculateAge(worker.birthDate) : undefined,
        }
      }));
      setResources([...projectResources, ...workerResources]);

      // イベント構築
      const projectEvents: CalendarEvent[] = projectsData.map(project => {
        const duration = getDuration(project.startDate, project.endDate);
        const endDate = project.endDate ? new Date(new Date(project.endDate).getTime() + 86400000).toISOString().split('T')[0] : project.startDate;
        const displayEndDate = project.endDate ? new Date(project.endDate) : new Date(project.startDate);
        const event: CalendarEvent = {
          id: `${RESOURCE_PREFIX.PROJECT_MAIN}${project.id}`,
          resourceId: `${RESOURCE_PREFIX.PROJECT}${project.id}`,
          title: `${project.name} (${formatDate(project.startDate)}～${formatDate(displayEndDate.toISOString().split('T')[0])} ${duration}日間)`,
          start: project.startDate,
          end: endDate,
          className: EVENT_CLASS_NAME.PROJECT_MAIN,
          editable: true,
        };
        if (project.bar_color) {
          event.backgroundColor = project.bar_color;
          event.borderColor = project.bar_color;
        }
        return event;
      });
      const assignmentEvents: CalendarEvent[] = assignmentsData.map(assignment => {
        const project = projectsData.find(p => p.id == assignment.projectId);
        const isOtherAssignment = !assignment.projectId && assignment.title;

        const event: CalendarEvent = {
          id: `assign_${assignment.id}`,
          resourceId: `${RESOURCE_PREFIX.WORKER}${assignment.workerId}`,
          title: assignment.title || (project ? project.name : '不明な予定'),
          start: assignment.date,
          className: EVENT_CLASS_NAME.ASSIGNMENT,
          extendedProps: { assignment_order: assignment.assignment_order },
        };

        if (isOtherAssignment) {
          event.borderColor = 'red';
          event.backgroundColor = 'white';
          event.textColor = 'red';
        } else if (project && project.bar_color) {
          event.backgroundColor = project.bar_color;
          event.borderColor = project.bar_color;
        }
        return event;
      });
      setEvents([...projectEvents, ...assignmentEvents]);
    } catch (e: any) {
      console.error('データ取得エラー:', e);
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