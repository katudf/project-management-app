// src/hooks/useEventHandlers.ts
import type { EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { supabase } from '../supabaseClient';
import type { CalendarEvent, Resource } from '@/types/schedule';
import { RESOURCE_PREFIX, EVENT_CLASS_NAME } from '@/constants/scheduleConstants';
import { getDuration, formatDate } from '@/utils/dateUtils';
import { getContrastTextColor } from '@/utils/colorUtils';

type NotificationHandler = (message: string, severity?: 'success' | 'error' | 'info' | 'warning') => void;

type ClipboardEventData = {
  event: CalendarEvent;
  projectId: number | null;
  offsetDays: number;
  offsetResourceIndex: number;
};

export type ClipboardData = {
  type: 'block' | 'single';
  data: ClipboardEventData[];
} | null;


export const useEventHandlers = (
  events: CalendarEvent[],
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>,
  resources: Resource[],
  showNotification: NotificationHandler,
  clipboard: ClipboardData,
  setClipboard: React.Dispatch<React.SetStateAction<ClipboardData>>,
  fetchData: () => Promise<void>
) => {

  const handleEventDrop = async (arg: EventDropArg) => {
    const { event, oldEvent, revert, newResource } = arg;
    const originalEvents = [...events];

    if (event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN) && newResource?.id.startsWith(RESOURCE_PREFIX.WORKER)) {
        revert(); 

        const ourEvent = originalEvents.find((e: CalendarEvent) => e.id === event.id);
        if (!ourEvent) {
            showNotification('元のイベントが見つかりません。', 'error');
            return;
        }

        const projectResource = resources.find((r: Resource) => r.id === ourEvent.resourceId);
        if (!projectResource) {
            showNotification('プロジェクトリソースが見つかりません。', 'error');
            return;
        }

        const projectId = Number(projectResource.id.replace('proj_', ''));
        const projectTitle = projectResource.title;
        const workerId = Number(newResource.id.replace(RESOURCE_PREFIX.WORKER, ''));
        const date = event.startStr;

        const { count, error: countError } = await supabase
            .from('Assignments')
            .select('*', { count: 'exact', head: true })
            .eq('workerId', workerId)
            .eq('date', date);

        if (countError || count === null) {
            showNotification('既存の配置件数の確認に失敗しました。', 'error');
            return;
        }
        if (count >= 3) {
            showNotification('一度に登録できる工事は3件までです。', 'warning');
            return;
        }

        try {
            const { data: insertedData, error: insertError } = await supabase
                .from('Assignments')
                .insert({ projectId, workerId, date })
                .select()
                .single();

            if (insertError) throw insertError;

            const newAssignmentEvent: CalendarEvent = {
                id: `assign_${insertedData.id}`,
                resourceId: newResource.id,
                title: projectTitle,
                start: date,
                className: EVENT_CLASS_NAME.ASSIGNMENT,
                editable: true,
            };

            if (ourEvent.backgroundColor) {
                newAssignmentEvent.backgroundColor = ourEvent.backgroundColor;
                newAssignmentEvent.borderColor = ourEvent.backgroundColor;
            }

            setEvents(prev => [...prev, newAssignmentEvent]);
            showNotification('人員を配置しました。', 'success');

        } catch (error) {
            showNotification('人員の配置に失敗しました。', 'error');
        }
        return;
    }

    if (event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN) || event.classNames.includes(EVENT_CLASS_NAME.TASK)) {
        const isProject = event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN);
        const table = isProject ? 'Projects' : 'ProjectTasks';
        const id = Number(event.id.replace(isProject ? RESOURCE_PREFIX.PROJECT_MAIN : RESOURCE_PREFIX.TASK_BAR, ''));

        let newStart = new Date(event.startStr);
        const duration = (oldEvent.end?.getTime() || oldEvent.start!.getTime()) - oldEvent.start!.getTime();
        let newEnd = new Date(newStart.getTime() + duration);

        if (!isProject) {
          const ourEvent = originalEvents.find((e: CalendarEvent) => e.id === event.id);
          const taskResource = resources.find((r: Resource) => r.id === ourEvent?.resourceId);

          if (taskResource && taskResource.parentId) {
            const parentProjectId = taskResource.parentId;
            const projectEvent = events.find((e: CalendarEvent) => 
                e.resourceId === parentProjectId && 
                e.className?.includes(EVENT_CLASS_NAME.PROJECT_MAIN)
            );

            if (projectEvent?.start && projectEvent.end) {
              const projectStart = new Date(projectEvent.start);
              const projectEnd = new Date(projectEvent.end);
              
              if (newStart < projectStart) {
                newStart = projectStart;
                newEnd = new Date(newStart.getTime() + duration);
                showNotification('タスクがプロジェクト開始日より前にならないように調整しました。', 'info');
              }
              if (newEnd > projectEnd) {
                newEnd = projectEnd;
                newStart = new Date(newEnd.getTime() - duration);
                showNotification('タスクがプロジェクト終了日より後にならないように調整しました。', 'info');
              }
            }
          }
        }
        
        const newStartStr = newStart.toISOString().split('T')[0];
        const newEndStr = newEnd.toISOString().split('T')[0];
        const dbEndDate = new Date(newEnd.getTime() - 1).toISOString().split('T')[0];

        setEvents(prev => prev.map((e: CalendarEvent) => {
          if (e.id === event.id) {
            const updatedEvent = { ...e, start: newStartStr, end: newEndStr };
            if (isProject) {
              const name = resources.find((r: Resource) => r.id === updatedEvent.resourceId)?.title || '';
              const displayDuration = getDuration(newStartStr, newEndStr);
              updatedEvent.title = `${name} (${formatDate(newStartStr)}～${dbEndDate} ${displayDuration}日間)`;
            }
            return updatedEvent;
          }
          return e;
        }));

        try {
          const { error } = await supabase
            .from(table)
            .update({ startDate: newStartStr, endDate: dbEndDate })
            .eq('id', id);

          if (error) throw error;

          if (isProject) {
            const dateDiff = newStart.getTime() - new Date(oldEvent.startStr).getTime();
            const projectResourceId = event.getResources()[0]?.id;

            const tasksToUpdate = originalEvents.filter((e: CalendarEvent) => {
              const taskResource = resources.find((r: Resource) => r.id === e.resourceId);
              return taskResource?.parentId === projectResourceId;
            });

            const updatedTaskEvents: CalendarEvent[] = [];
            for (const taskEvent of tasksToUpdate) {
              const taskStart = new Date(new Date(taskEvent.start).getTime() + dateDiff);
              const taskEnd = new Date(new Date(taskEvent.end!).getTime() + dateDiff);
              const taskStartStr = taskStart.toISOString().split('T')[0];
              const taskEndStr = taskEnd.toISOString().split('T')[0];
              const taskDbEndDate = new Date(taskEnd.getTime() - 1).toISOString().split('T')[0];

              await supabase
                .from('ProjectTasks')
                .update({ startDate: taskStartStr, endDate: taskDbEndDate })
                .eq('id', Number(taskEvent.id.replace(RESOURCE_PREFIX.TASK_BAR, '')));
              
              updatedTaskEvents.push({ ...taskEvent, start: taskStartStr, end: taskEndStr });
            }
            
            setEvents(currentEvents => currentEvents.map((e: CalendarEvent) => 
                updatedTaskEvents.find(ute => ute.id === e.id) || e
            ));
          }
          showNotification('工程を更新しました。', 'success');
        } catch (error) {
          showNotification('工程の更新に失敗しました。', 'error');
          setEvents(originalEvents);
        }
        return;
    }

    if (event.classNames.includes(EVENT_CLASS_NAME.ASSIGNMENT)) {
      const isCopy = arg.jsEvent.altKey;
      const draggedCalendarEvent = originalEvents.find((e: CalendarEvent) => e.id === oldEvent.id);
      if (!draggedCalendarEvent) { revert(); return; }
      const oldResourceId = draggedCalendarEvent.resourceId;
      const oldDate = draggedCalendarEvent.start;
      if (!oldResourceId) { revert(); return; }

      const eventsInBlock = originalEvents.filter((e: CalendarEvent) =>
        e.resourceId === oldResourceId &&
        e.start === oldDate &&
        e.className?.includes(EVENT_CLASS_NAME.ASSIGNMENT)
      );

      if (eventsInBlock.length === 0) { revert(); return; }
      const newResource = arg.newResource || event.getResources()[0];
      if (!newResource || !newResource.id.startsWith(RESOURCE_PREFIX.WORKER)) {
        showNotification("人員配置は作業員の行にのみ移動できます。", 'warning');
        revert();
        return;
      }

      const newResourceId = newResource.id;
      const newDate = event.startStr;
      const newWorkerId = Number(newResourceId.replace(RESOURCE_PREFIX.WORKER, ''));

      const { count: existingCount, error: countError } = await supabase
        .from('Assignments')
        .select('*', { count: 'exact', head: true })
        .eq('workerId', newWorkerId)
        .eq('date', newDate);

      if (countError || existingCount === null) {
        showNotification('既存の配置件数の確認に失敗しました。', 'error');
        revert();
        return;
      }

      if (existingCount + eventsInBlock.length > 3) {
        showNotification(`一度に登録できる工事は3件までです。移動先に${existingCount}件あるため、${eventsInBlock.length}件のブロックを移動できません。`, 'warning');
        revert();
        return;
      }

      try {
        if (isCopy) {
          revert();
          const newAssignmentsToInsert = eventsInBlock.map((e: CalendarEvent) => {
            const project = resources.find((r: Resource) => r.title === e.title && r.group === 'projects');
            if (project) {
              return { projectId: Number(project.id.replace(RESOURCE_PREFIX.PROJECT, '')), workerId: newWorkerId, date: newDate };
            } else {
              return { workerId: newWorkerId, date: newDate, title: e.title };
            }
          });

          const { data: insertedData, error: insertError } = await supabase.from('Assignments').insert(newAssignmentsToInsert).select();
          if (insertError) throw insertError;

          const newEvents: CalendarEvent[] = insertedData.map((a: any, index: number) => {
            const originalEvent = eventsInBlock[index];
            const newEvent: CalendarEvent = {
              id: `assign_${a.id}`,
              resourceId: `work_${a.workerId}`,
              title: originalEvent.title,
              start: a.date,
              end: a.date,
              className: EVENT_CLASS_NAME.ASSIGNMENT,
              editable: true,
            };
            if (originalEvent.backgroundColor) {
              newEvent.backgroundColor = originalEvent.backgroundColor;
              newEvent.borderColor = originalEvent.borderColor;
            }
            return newEvent;
          });

          setEvents(prev => [...prev, ...newEvents]);
          showNotification('ブロックをコピーしました。', 'success');

        } else {
          if (oldResourceId === newResourceId && oldDate === newDate) return;

          const blockEventIds = new Set(eventsInBlock.map((e: CalendarEvent) => e.id));
          setEvents(prevEvents => {
              const otherEvents = prevEvents.filter((e: CalendarEvent) => !blockEventIds.has(e.id));
              const updatedBlockEvents = eventsInBlock.map((e: CalendarEvent) => ({ ...e, resourceId: newResourceId, start: newDate, end: newDate }));
              return [...otherEvents, ...updatedBlockEvents];
          });

          const updates = eventsInBlock.map((e: CalendarEvent) => {
            const assignmentId = Number(e.id.replace('assign_', ''));
            return supabase.from('Assignments').update({ workerId: newWorkerId, date: newDate }).eq('id', assignmentId);
          });

          const results = await Promise.all(updates);
          const updateError = results.find(res => res.error);
          if (updateError) throw updateError.error;
          showNotification('人員配置を更新しました。', 'success');
        }
      } catch (error) {
        showNotification("操作に失敗しました。", 'error');
        setEvents(originalEvents);
      }
      return;
    }
    revert();
  };

  const handleEventResize = async (arg: EventResizeDoneArg) => {
    const { event, revert, oldEvent } = arg;
    const originalEvents = [...events];

    if (event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN) || event.classNames.includes(EVENT_CLASS_NAME.TASK)) {
        let newStart = new Date(event.startStr);
        let newEnd = new Date(event.endStr);

        if (!event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN)) {
            const ourEvent = originalEvents.find((e: CalendarEvent) => e.id === event.id);
            const taskResource = resources.find((r: Resource) => r.id === ourEvent?.resourceId);

            if (taskResource && taskResource.parentId) {
                const parentProjectId = taskResource.parentId;
                const projectEvent = events.find((e: CalendarEvent) => 
                    e.resourceId === parentProjectId &&
                    e.className?.includes(EVENT_CLASS_NAME.PROJECT_MAIN)
                );

                if (projectEvent?.start && projectEvent.end) {
                    const projectStart = new Date(projectEvent.start);
                    const projectEnd = new Date(projectEvent.end);
                    if (!oldEvent.start || !oldEvent.end) {
                      revert();
                      return;
                    }
                    const duration = oldEvent.end.getTime() - oldEvent.start.getTime();

                    if (newStart < projectStart) {
                        newStart = projectStart;
                        showNotification('タスクの開始日はプロジェクトの開始日より前にできません。', 'warning');
                    }
                    if (newEnd > projectEnd) {
                        newEnd = projectEnd;
                        newStart = new Date(newEnd.getTime() - duration);
                        showNotification('タスクがプロジェクト終了日より後にならないように調整しました。', 'info');
                    }
                    
                    if (newEnd <= newStart) {
                        showNotification('終了日は開始日より後である必要があります。', 'warning');
                        revert();
                        return;
                    }
                }
            }
        }

        const newStartStr = newStart.toISOString().split('T')[0];
        const newEndStr = newEnd.toISOString().split('T')[0];
        const dbEndDate = new Date(newEnd.getTime() - 1).toISOString().split('T')[0];
        
        const table = event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN) ? 'Projects' : 'ProjectTasks';
        const id = Number(event.id.replace(event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN) ? RESOURCE_PREFIX.PROJECT_MAIN : RESOURCE_PREFIX.TASK_BAR, ''));

        setEvents(prev => prev.map((e: CalendarEvent) => {
            if (e.id === event.id) {
                const updatedEvent = { ...e, start: newStartStr, end: newEndStr };
                if (event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN)) {
                    const name = resources.find((r: Resource) => r.id === updatedEvent.resourceId)?.title || '';
                    const displayDuration = getDuration(newStartStr, newEndStr);
                    updatedEvent.title = `${name} (${formatDate(newStartStr)}～${dbEndDate} ${displayDuration}日間)`;
                }
                return updatedEvent;
            }
            return e;
        }));

        try {
            const { error } = await supabase
                .from(table)
                .update({ startDate: newStartStr, endDate: dbEndDate })
                .eq('id', id);
            if (error) throw error;
            showNotification('工程期間を更新しました。', 'success');
        } catch (error) {
            showNotification('期間の変更に失敗しました。', 'error');
            setEvents(originalEvents);
        }
        return;
    } else if (event.classNames.includes(EVENT_CLASS_NAME.ASSIGNMENT)) {
        revert();
        showNotification('人員配置は単日イベントのため、期間の変更はできません。', 'warning');
        return;
    }
    revert();
  };

  const handleEventUpdate = async (updatedEvent: CalendarEvent): Promise<boolean> => {
    const originalEvents = [...events];
    const { id, start } = updatedEvent;

    setEvents(prev => prev.map((e: CalendarEvent) => e.id === id ? { ...e, start: updatedEvent.start } : e));

    if (id.startsWith('assign_')) {
      const assignmentId = Number(id.replace('assign_', ''));
      try {
        const { error } = await supabase
          .from('Assignments')
          .update({ date: start })
          .eq('id', assignmentId);

        if (error) throw error;

        showNotification('配置を更新しました。', 'success');
        return true;
      } catch (error) {
        console.error("配置の更新に失敗しました:", error);
        showNotification("配置の更新に失敗しました。", 'error');
        setEvents(originalEvents);
        return false;
      }
    } else {
      showNotification('この種類のイベントは編集できません。', 'info');
      setEvents(originalEvents);
      return false;
    }
  };

  const handleAssignmentCopy = (targetEvents: CalendarEvent[]) => {
    if (targetEvents.length === 0) return;

    const workerResources = resources.filter(r => r.id.startsWith(RESOURCE_PREFIX.WORKER));

    let baseEvent = targetEvents[0];
    let baseDate = new Date(baseEvent.start);
    let baseResourceIndex = workerResources.findIndex(r => r.id === baseEvent.resourceId);

    for (const event of targetEvents) {
        const eventDate = new Date(event.start);
        const eventResourceIndex = workerResources.findIndex(r => r.id === event.resourceId);

        if (eventDate < baseDate) {
            baseDate = eventDate;
            baseResourceIndex = eventResourceIndex;
            baseEvent = event;
        } else if (eventDate.getTime() === baseDate.getTime()) {
            if (eventResourceIndex !== -1 && (baseResourceIndex === -1 || eventResourceIndex < baseResourceIndex)) {
                baseResourceIndex = eventResourceIndex;
                baseEvent = event;
            }
        }
    }

    const clipboardBlockData: ClipboardEventData[] = targetEvents.map((event: CalendarEvent) => {
      const projectResource = resources.find((r: Resource) => r.title === event.title && r.group === 'projects');
      const projectId = projectResource ? Number(projectResource.id.replace('proj_', '')) : null;
      
      const eventDate = new Date(event.start);
      const utcEventDate = Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate());
      const utcBaseDate = Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate());
      const offsetDays = (utcEventDate - utcBaseDate) / (1000 * 60 * 60 * 24);

      const eventResourceIndex = workerResources.findIndex(r => r.id === event.resourceId);
      const offsetResourceIndex = (baseResourceIndex !== -1 && eventResourceIndex !== -1) 
                                  ? eventResourceIndex - baseResourceIndex 
                                  : 0;

      return { event, projectId, offsetDays, offsetResourceIndex };
    });

    setClipboard({ type: 'block', data: clipboardBlockData });
    showNotification(`${targetEvents.length}件の工事名をコピーしました。`, 'success');
  };

  const handleAssignmentCut = async (targetEvents: CalendarEvent[]) => {
    if (targetEvents.length === 0) return;
    handleAssignmentCopy(targetEvents);
    await handleAssignmentDelete(targetEvents, false);
    showNotification(`${targetEvents.length}件の工事名を切り取りました。`, 'success');
  };

  const handleAssignmentDelete = async (targetEvents: CalendarEvent[], showSuccessNotification = true) => {
    if (targetEvents.length === 0) return;
    const originalEvents = [...events];
    const idsToDelete = targetEvents.map((e: CalendarEvent) => Number(e.id.replace('assign_', '')));
    
    setEvents(prev => prev.filter((e: CalendarEvent) => !idsToDelete.includes(Number(e.id.replace('assign_', '')))));

    try {
      const { error } = await supabase.from('Assignments').delete().in('id', idsToDelete);
      if (error) throw error;
      if (showSuccessNotification) {
        showNotification(`${targetEvents.length}件の工事名を削除しました。`, 'success');
      }
    } catch (error) {
      showNotification('工事名の削除に失敗しました。', 'error');
      setEvents(originalEvents);
    }
  };

  const handleBlockCopy = (resourceId: string, date: string) => {
    const eventsToCopy = events.filter((e: CalendarEvent) => e.resourceId === resourceId && e.start === date);
    if (eventsToCopy.length > 0) {
      const clipboardBlockData: ClipboardEventData[] = eventsToCopy.map((event: CalendarEvent) => {
        const projectResource = resources.find((r: Resource) => r.title === event.title && r.group === 'projects');
        const projectId = projectResource ? Number(projectResource.id.replace('proj_', '')) : null;
        return { event, projectId, offsetDays: 0, offsetResourceIndex: 0 };
      });

      setClipboard({ type: 'block', data: clipboardBlockData });
      showNotification('ブロックをコピーしました。', 'success');
    }
  };

  const handleBlockCut = async (resourceId: string, date: string) => {
    handleBlockCopy(resourceId, date);
    await handleBlockDelete(resourceId, date, false);
  };

  const handleBlockDelete = async (resourceId: string, date: string, showSuccessNotification = true) => {
    const originalEvents = [...events];
    const eventsToDelete = originalEvents.filter((e: CalendarEvent) => e.resourceId === resourceId && e.start === date);
    const idsToDelete = eventsToDelete.map((e: CalendarEvent) => Number(e.id.replace('assign_', '')));

    if (idsToDelete.length === 0) return;

    setEvents(prev => prev.filter((e: CalendarEvent) => !(e.resourceId === resourceId && e.start === date)));

    try {
      const { error } = await supabase.from('Assignments').delete().in('id', idsToDelete);
      if (error) throw error;
      if (showSuccessNotification) {
        showNotification('ブロックを削除しました。', 'success');
      }
    } catch (error) {
      showNotification('ブロックの削除に失敗しました。', 'error');
      setEvents(originalEvents);
    }
  };

  const handlePaste = async (targetResourceId: string, targetDate: string) => {
    if (!clipboard) {
      showNotification('クリップボードにデータがありません。', 'warning');
      return;
    }

    const originalEvents = [...events];
    const pasteBaseDate = new Date(targetDate);
    const workerResources = resources.filter(r => r.id.startsWith(RESOURCE_PREFIX.WORKER));
    const targetResourceIndex = workerResources.findIndex(r => r.id === targetResourceId);

    if (targetResourceIndex === -1) {
      showNotification('貼り付け先の作業員が見つかりません。', 'error');
      return;
    }

    // 貼り付け先のセル情報と、そこに挿入されるアサインメントのリストを作成
    const pasteActions = new Map<string, { workerId: number; date: string; assignments: any[] }>();

    clipboard.data.forEach((clipboardItem: ClipboardEventData) => {
      const newDate = new Date(pasteBaseDate.getTime());
      newDate.setDate(newDate.getDate() + (clipboardItem.offsetDays || 0));
      const newDateStr = formatDate(newDate);

      const newResourceIndex = targetResourceIndex + (clipboardItem.offsetResourceIndex || 0);
      if (newResourceIndex < 0 || newResourceIndex >= workerResources.length) return;
      
      const newResource = workerResources[newResourceIndex];
      const newWorkerId = Number(newResource.id.replace(RESOURCE_PREFIX.WORKER, ''));
      const key = `${newWorkerId}_${newDateStr}`;

      if (!pasteActions.has(key)) {
        pasteActions.set(key, { workerId: newWorkerId, date: newDateStr, assignments: [] });
      }
      
      pasteActions.get(key)!.assignments.push({
        projectId: clipboardItem.projectId,
        title: clipboardItem.projectId ? null : clipboardItem.event.title,
        assignment_order: clipboardItem.event.extendedProps?.assignment_order ?? 0
      });
    });

    if (pasteActions.size === 0) return;

    try {
      // 1. 削除対象のIDを特定
      const idsToDelete: number[] = [];
      pasteActions.forEach((action) => {
        const resourceId = `${RESOURCE_PREFIX.WORKER}${action.workerId}`;
        originalEvents.forEach(event => {
          if (event.resourceId === resourceId && event.start === action.date && event.id.startsWith('assign_')) {
            idsToDelete.push(Number(event.id.replace('assign_', '')));
          }
        });
      });

      // 2. 既存のアサインメントを削除
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase.from('Assignments').delete().in('id', idsToDelete);
        if (deleteError) throw deleteError;
      }

      // 3. 新しいアサインメントのデータを作成
      const assignmentsToInsert: any[] = [];
      pasteActions.forEach(action => {
        action.assignments
          .sort((a, b) => a.assignment_order - b.assignment_order)
          .forEach(assign => {
            assignmentsToInsert.push({
              workerId: action.workerId,
              date: action.date,
              projectId: assign.projectId,
              title: assign.title,
              assignment_order: assign.assignment_order,
            });
          });
      });

      if (assignmentsToInsert.length === 0) {
        // 削除のみ行われた場合
        setEvents(prev => prev.filter(e => !idsToDelete.map(id => `assign_${id}`).includes(e.id)));
        showNotification('貼り付け（上書き）が完了しました。', 'success');
        return;
      }

      // 4. 新しいアサインメントを挿入し、結果を取得
      const { data: newAssignments, error: insertError } = await supabase
        .from('Assignments')
        .insert(assignmentsToInsert)
        .select();

      if (insertError) throw insertError;
      if (!newAssignments) throw new Error("Insert operation did not return data.");

      // 5. UIを更新
      const newEventsPromises = newAssignments.map(async (a: any) => {
        let title = a.title;
        let backgroundColor: string | undefined = undefined;
        let textColor: string | undefined = undefined;
        
        if (a.projectId) {
          const { data: projectData } = await supabase
            .from('Projects')
            .select('name, bar_color')
            .eq('id', a.projectId)
            .single();
          
          if (projectData) {
            title = projectData.name;
            if (projectData.bar_color) {
              backgroundColor = projectData.bar_color;
              textColor = getContrastTextColor(backgroundColor);
            }
          }
        }

        return {
          id: `assign_${a.id}`,
          resourceId: `${RESOURCE_PREFIX.WORKER}${a.workerId}`,
          title: title,
          start: a.date,
          className: EVENT_CLASS_NAME.ASSIGNMENT,
          editable: true,
          extendedProps: { assignment_order: a.assignment_order },
          backgroundColor: backgroundColor,
          borderColor: backgroundColor,
          textColor: textColor,
        };
      });

      const newEvents = await Promise.all(newEventsPromises);

      setEvents(prevEvents => {
        const idsToDeleteSet = new Set(idsToDelete.map(id => `assign_${id}`));
        const filteredEvents = prevEvents.filter(e => !idsToDeleteSet.has(e.id));
        return [...filteredEvents, ...newEvents];
      });

      showNotification('貼り付けが完了しました。', 'success');

    } catch (error: any) {
      console.error('Paste error:', error);
      showNotification(`貼り付けに失敗しました: ${error.message}`, 'error');
      setEvents(originalEvents); // エラー時は状態を元に戻す
    }
  };

  const handleAddOtherAssignment = async (title: string, date: string, resourceId: string): Promise<boolean> => {
    if (!resourceId.startsWith(RESOURCE_PREFIX.WORKER)) {
        showNotification('「その他予定の追加」は作業員の行でのみ可能です。', 'warning');
        return false;
    }
    const workerId = Number(resourceId.replace(RESOURCE_PREFIX.WORKER, ''));

    try {
        const { data, error } = await supabase
            .from('Assignments')
            .insert({ title, date, workerId })
            .select()
            .single();

        if (error) throw error;

        const newEvent: CalendarEvent = {
            id: `assign_${data.id}`,
            resourceId: `work_${data.workerId}`,
            title: data.title,
            start: data.date,
            className: EVENT_CLASS_NAME.ASSIGNMENT,
        };
        setEvents(prev => [...prev, newEvent]);
        showNotification('予定を追加しました。', 'success');
        return true;
    } catch (error) {
        showNotification('予定の追加に失敗しました。', 'error');
        return false;
    }
  };

  const handleReorderAssignments = async (reorderedAssignments: CalendarEvent[]) => {
      try {
          const updates = reorderedAssignments.map((event: CalendarEvent, index: number) => {
              const id = Number(event.id.replace('assign_', ''));
              return supabase.from('Assignments').update({ assignment_order: index }).eq('id', id);
          });
          const results = await Promise.all(updates);
          const firstError = results.find(res => res.error);
          if (firstError) {
            console.error("Supabase update error:", firstError.error);
            throw firstError.error;
          }

          await fetchData();
          showNotification('表示順を更新しました。', 'success');
          return true;
      } catch (error: any) {
          console.error("Error reordering assignments:", error);
          showNotification('表示順の更新に失敗しました。', 'error');
          return false;
      }
  };

  const handleReorderResources = async (reorderedResources: Resource[]) => {
    try {
      const updates = reorderedResources.map((resource: Resource, index: number) => {
        const id = Number(resource.id.replace(resource.group === 'projects' ? RESOURCE_PREFIX.PROJECT : RESOURCE_PREFIX.WORKER, ''));
        const table = resource.group === 'projects' ? 'Projects' : 'Workers';
        return supabase.from(table).update({ order: index }).eq('id', id);
      });

      const results = await Promise.all(updates);
      const firstError = results.find(res => res.error);
      if (firstError) {
        console.error("Supabase resource reorder error:", firstError.error);
        throw firstError.error;
      }

      await fetchData();
      showNotification('リソースの表示順を更新しました。', 'success');
      return true;
    } catch (error: any) {
      console.error("Error reordering resources:", error);
      showNotification('リソースの表示順の更新に失敗しました。', 'error');
      return false;
    }
  };

  return { handleEventDrop, handleEventResize, handleEventUpdate, handleAssignmentCopy, handleAssignmentCut, handleAssignmentDelete, handleBlockCopy, handleBlockCut, handleBlockDelete, handlePaste, handleAddOtherAssignment, handleReorderAssignments, handleReorderResources };
};