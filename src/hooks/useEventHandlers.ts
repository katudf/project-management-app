// src/hooks/useEventHandlers.ts
import type { EventDropArg, EventResizeArg } from '@fullcalendar/core';
import { supabase } from '../supabaseClient';
import type { CalendarEvent, Resource } from '@/types/schedule';
import { RESOURCE_PREFIX, EVENT_CLASS_NAME } from '@/constants/scheduleConstants';
import { getDuration, formatDate } from '@/utils/dateUtils';

type NotificationHandler = (message: string, severity?: 'success' | 'error' | 'info' | 'warning') => void;

// projectIdもクリップボードに保持するように型を拡張
type ClipboardEventData = {
  event: CalendarEvent;
  projectId: number | null;
};
export type ClipboardData = { type: 'block' | 'single'; data: ClipboardEventData[] } | null;

export const useEventHandlers = (
  events: CalendarEvent[],
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>,
  resources: Resource[],
  showNotification: NotificationHandler,
  clipboard: ClipboardData,
  setClipboard: React.Dispatch<React.SetStateAction<ClipboardData>>,
  fetchData: () => Promise<void> // Add fetchData to dependencies
) => {

  // --- Event Drop Handler ---
  const handleEventDrop = async (arg: EventDropArg) => {
    const { event, oldEvent, revert, newResource } = arg;
    const originalEvents = [...events];

    // --- 1. Project drop on worker to create assignment ---
    if (event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN) && newResource?.id.startsWith(RESOURCE_PREFIX.WORKER)) {
        revert(); // Don't move the project event, just use its data

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

    // --- 2. Project/Task move (date shift) ---
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

    // --- 3. Assignment move/copy (block-aware) ---
    if (event.classNames.includes(EVENT_CLASS_NAME.ASSIGNMENT)) {
      const isCopy = arg.jsEvent.altKey;

      // Find the dragged event in our original state to get accurate old position
      const draggedCalendarEvent = originalEvents.find((e: CalendarEvent) => e.id === oldEvent.id);

      if (!draggedCalendarEvent) {
        revert();
        return;
      }

      const oldResourceId = draggedCalendarEvent.resourceId;
      const oldDate = draggedCalendarEvent.start;

      if (!oldResourceId) {
        revert();
        return;
      }

      // Find all events that were in the original block (same resource, same date)
      const eventsInBlock = originalEvents.filter((e: CalendarEvent) =>
        e.resourceId === oldResourceId &&
        e.start === oldDate &&
        e.className?.includes(EVENT_CLASS_NAME.ASSIGNMENT)
      );

      if (eventsInBlock.length === 0) {
        revert();
        return;
      }

      const newResource = arg.newResource || event.getResources()[0];

      if (!newResource || !newResource.id.startsWith(RESOURCE_PREFIX.WORKER)) {
        showNotification("人員配置は作業員の行にのみ移動できます。", 'warning');
        revert();
        return;
      }

      const newResourceId = newResource.id;
      const newDate = event.startStr;
      const newWorkerId = Number(newResourceId.replace(RESOURCE_PREFIX.WORKER, ''));

      // --- Capacity Check ---
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

      // --- Main Logic (Copy or Move) ---
      try {
        if (isCopy) {
          // --- COPY LOGIC ---
          revert(); // Revert the original event move, as we are creating new ones

          const newAssignmentsToInsert = eventsInBlock.map((e: CalendarEvent) => {
            const project = resources.find((r: Resource) => r.title === e.title && r.group === 'projects');
            if (project) {
              return {
                projectId: Number(project.id.replace(RESOURCE_PREFIX.PROJECT, '')),
                workerId: newWorkerId,
                date: newDate,
              };
            } else {
              return {
                workerId: newWorkerId,
                date: newDate,
                title: e.title,
              };
            }
          });

          const { data: insertedData, error: insertError } = await supabase
            .from('Assignments')
            .insert(newAssignmentsToInsert)
            .select();

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
          // --- MOVE LOGIC ---
          if (oldResourceId === newResourceId && oldDate === newDate) {
            return; // No change, do nothing
          }

          const blockEventIds = new Set(eventsInBlock.map((e: CalendarEvent) => e.id));
          setEvents(prevEvents => {
              const otherEvents = prevEvents.filter((e: CalendarEvent) => !blockEventIds.has(e.id));
              const updatedBlockEvents = eventsInBlock.map((e: CalendarEvent) => ({
                  ...e,
                  resourceId: newResourceId,
                  start: newDate,
                  end: newDate,
              }));
              return [...otherEvents, ...updatedBlockEvents];
          });

          const updates = eventsInBlock.map((e: CalendarEvent) => {
            const assignmentId = Number(e.id.replace('assign_', ''));
            return supabase
              .from('Assignments')
              .update({ workerId: newWorkerId, date: newDate })
              .eq('id', assignmentId);
          });

          const results = await Promise.all(updates);
          const updateError = results.find(res => res.error);

          if (updateError) throw updateError.error;

          showNotification('人員配置を更新しました。', 'success');
        }
      } catch (error) {
        showNotification("操作に失敗しました。", 'error');
        setEvents(originalEvents); // Revert on any failure
      }
      return;
    }

    revert();
  };


  // --- Event Resize Handler ---
  const handleEventResize = async (arg: EventResizeArg) => {
    const { event, revert } = arg;
    const originalEvents = [...events];

    if (event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN) || event.classNames.includes(EVENT_CLASS_NAME.TASK)) {
        const isProject = event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN);
        let newStart = new Date(event.startStr);
        let newEnd = new Date(event.endStr);

        // --- Task boundary check ---
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
        
        const table = isProject ? 'Projects' : 'ProjectTasks';
        const id = Number(event.id.replace(isProject ? RESOURCE_PREFIX.PROJECT_MAIN : RESOURCE_PREFIX.TASK_BAR, ''));

        // Optimistic UI Update
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
            showNotification('工程期間を更新しました。', 'success');
        } catch (error) {
            showNotification('期間の変更に失敗しました。', 'error');
            setEvents(originalEvents);
        }
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

  const handleAssignmentCopy = (targetEvent: CalendarEvent) => {
    const projectId = Number(resources.find((r: Resource) => r.title === targetEvent.title)?.id.replace('proj_', '') || null);
    const clipboardData: ClipboardEventData = { event: targetEvent, projectId: projectId };

    setClipboard({ type: 'single', data: [clipboardData] });
    showNotification('工事名をコピーしました。', 'success');
  };

  const handleAssignmentCut = async (targetEvent: CalendarEvent) => {
    const projectId = Number(resources.find((r: Resource) => r.title === targetEvent.title)?.id.replace('proj_', '') || null);
    const clipboardData: ClipboardEventData = { event: targetEvent, projectId: projectId };

    setClipboard({ type: 'single', data: [clipboardData] });
    await handleAssignmentDelete(targetEvent, false);
  };

  const handleAssignmentDelete = async (targetEvent: CalendarEvent, showSuccessNotification = true) => {
    const originalEvents = [...events];
    const assignmentId = Number(targetEvent.id.replace('assign_', ''));

    setEvents(prev => prev.filter((e: CalendarEvent) => e.id !== targetEvent.id));

    try {
      const { error } = await supabase.from('Assignments').delete().eq('id', assignmentId);
      if (error) throw error;
      if (showSuccessNotification) {
        showNotification('工事名を削除しました。', 'success');
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
        const projectId = Number(resources.find((r: Resource) => r.title === event.title)?.id.replace('proj_', '') || null);
        return { event, projectId };
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
    const targetWorkerId = Number(targetResourceId.replace(RESOURCE_PREFIX.WORKER, ''));

    const { count: existingCount, error: countError } = await supabase
      .from('Assignments')
      .select('*', { count: 'exact', head: true })
      .eq('workerId', targetWorkerId)
      .eq('date', targetDate);

    if (countError || existingCount === null) {
      showNotification('貼り付け先の情報を確認できませんでした。', 'error');
      return;
    }

    if (existingCount + clipboard.data.length > 3) {
      showNotification('貼り付け先の1日の登録上限(3件)を超えてしまいます。', 'error');
      return;
    }

    const newAssignmentsToInsert = clipboard.data.map((clipboardItem: ClipboardEventData) => ({
      projectId: clipboardItem.projectId,
      workerId: targetWorkerId,
      date: targetDate,
    }));

    try {
      const { data: insertedData, error: insertError } = await supabase
        .from('Assignments')
        .insert(newAssignmentsToInsert)
        .select();

      if (insertError) throw insertError;

      const newEvents: CalendarEvent[] = insertedData.map((a: any, index: number) => ({
        id: `assign_${a.id}`,
        resourceId: `work_${a.workerId}`,
        title: clipboard.data[index].event.title,
        start: a.date,
        className: EVENT_CLASS_NAME.ASSIGNMENT,
      }));

      setEvents(prev => [...prev, ...newEvents]);
      showNotification('貼り付けが完了しました。', 'success');

    } catch (error) {
      showNotification('貼り付けに失敗しました。', 'error');
      setEvents(originalEvents);
    }
  };

  const handleAddOtherAssignment = async (title: string, date: string, resourceId: string) => {
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
    } catch (error) {
        showNotification('予定の追加に失敗しました。', 'error');
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
            throw firstError.error; // Throw the actual error object
          }

          await fetchData(); // Call fetchData to re-render UI
          showNotification('表示順を更新しました。', 'success');
          return true;
      } catch (error: any) { // Catch the thrown error
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