// src/pages/OverallSchedulePage.tsx
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Paper, CircularProgress, Alert, Typography, Box, Button, Snackbar, IconButton } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import ReplayIcon from '@mui/icons-material/Replay';
import { useContextMenu } from 'react-contexify';
import 'react-contexify/dist/ReactContexify.css';

import { useScheduleData } from '@/hooks/useScheduleData';
import { useEventHandlers, type ClipboardData } from '@/hooks/useEventHandlers';
import { EVENT_CLASS_NAME, RESOURCE_PREFIX } from '@/constants/scheduleConstants';
import type { CalendarEvent, Resource } from '@/types/schedule';
import { formatDate } from '@/utils/dateUtils';
import { supabase } from '@/supabaseClient';
import type { ColorResult } from 'react-color';

// Import new components
import { ScheduleCalendar } from '../components/schedule/ScheduleCalendar';
import { ScheduleContextMenu, CONTEXT_MENU_ID } from '../components/schedule/ScheduleContextMenu';
import { ReorderAssignmentsDialog } from '../components/schedule/dialogs/ReorderAssignmentsDialog';
import { ReorderResourcesDialog } from '../components/schedule/dialogs/ReorderResourcesDialog';
import { EditAssignmentDialog } from '../components/schedule/dialogs/EditAssignmentDialog';
import { EditProjectDialog } from '../components/schedule/dialogs/EditProjectDialog';
import { AddOtherAssignmentDialog } from '../components/schedule/dialogs/AddOtherAssignmentDialog';

interface CompanyHoliday {
  id: number;
  date: string;
  description: string;
}

export default function OverallSchedulePage() {
  // --- DATA & STATE ---
  const { resources, events, setEvents, loading, error: dataError, fetchData } = useScheduleData();
  const [calendarTitle, setCalendarTitle] = useState('');
  const [companyHolidays, setCompanyHolidays] = useState<CompanyHoliday[]>([]);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState<CalendarEvent[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning'; }>({ open: false, message: '', severity: 'info' });
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<{ resourceId: string; date: Date } | null>(null);

  // --- REFS ---
  const calendarRef = useRef<FullCalendar | null>(null);
  const lastHoveredCellRef = useRef<HTMLElement | null>(null);

  // --- DIALOG STATE ---
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editFormData, setEditFormData] = useState<{ title: string; start: string; }>({ title: '', start: '' });
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [projectEditDialogOpen, setProjectEditDialogOpen] = useState(false);
  const [projectEditFormData, setProjectEditFormData] = useState<{ name: string; bar_color: string; }>({ name: '', bar_color: '' });
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [reorderableAssignments, setReorderableAssignments] = useState<CalendarEvent[]>([]);
  const [reorderResourceDialogOpen, setReorderResourceDialogOpen] = useState(false);
  const [reorderableResources, setReorderableResources] = useState<Resource[]>([]);
  const [otherAssignmentDialogOpen, setOtherAssignmentDialogOpen] = useState(false);
  const [otherAssignmentTitle, setOtherAssignmentTitle] = useState('');
  const [otherAssignmentDate, setOtherAssignmentDate] = useState('');
  const [otherAssignmentResourceId, setOtherAssignmentResourceId] = useState('');
  const [dummyEvents, setDummyEvents] = useState<CalendarEvent[]>([]);

  // --- HOOKS ---
  const { show } = useContextMenu({ id: CONTEXT_MENU_ID });
  const showNotification = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({ open: true, message, severity });
  }, []);
  const { handleEventDrop, handleEventResize, handleEventUpdate, handleAssignmentCopy, handleAssignmentCut, handleAssignmentDelete, handleBlockCopy, handleBlockCut, handleBlockDelete, handlePaste, handleAddOtherAssignment, handleReorderAssignments } = useEventHandlers(events, setEvents, resources, showNotification, clipboard, setClipboard, fetchData);

  // --- COMPUTED VALUES ---
  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    events
      .filter(e => e.className === EVENT_CLASS_NAME.ASSIGNMENT)
      .forEach(e => {
        if (e.resourceId && e.start) {
          const key = `${e.resourceId}_${e.start}`;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      });
    return counts;
  }, [events]);

  const displayEvents = useMemo(() => {
    const realEvents = events.filter(e => !e.extendedProps?.isDummy);
    const assignmentsMap = new Map<string, CalendarEvent[]>();
    realEvents.filter(e => e.className === EVENT_CLASS_NAME.ASSIGNMENT).forEach(e => {
      const key = `${e.resourceId}_${e.start}`;
      if (!assignmentsMap.has(key)) {
        assignmentsMap.set(key, []);
      }
      assignmentsMap.get(key)!.push(e);
    });

    const nonAssignmentEvents = realEvents.filter(e => e.className !== EVENT_CLASS_NAME.ASSIGNMENT);
    const limitedAssignments: CalendarEvent[] = [];
    assignmentsMap.forEach((eventList) => {
      const sortedList = [...eventList].sort((a, b) => (a.extendedProps?.assignment_order ?? 0) - (b.extendedProps?.assignment_order ?? 0));
      const listToProcess = sortedList.length > 3 ? sortedList.slice(0, 3) : sortedList;
      const count = listToProcess.length;
      const heightClass = `assignment-count-${count}`;
      const styledList = listToProcess.map(e => ({ ...e, className: `${e.className || ''} ${heightClass}`.trim() }));
      limitedAssignments.push(...styledList);
    });

    return [...nonAssignmentEvents, ...limitedAssignments, ...dummyEvents];
  }, [events, dummyEvents]);

  // --- CALLBACKS & HANDLERS ---
  const handleCloseDialog = useCallback(() => {
    setEditingEvent(null);
    setOtherAssignmentDialogOpen(false);
    setReorderDialogOpen(false);
    setReorderResourceDialogOpen(false);
    setProjectEditDialogOpen(false);
    setEditingProject(null);
  }, []);

  const handleGridInteraction = (
    resourceId: string,
    date: Date,
    isShift: boolean,
    isCtrl: boolean,
    clickedEventId: string | null
  ) => {
    if (isShift && selectionAnchor) {
      const { resourceId: anchorResourceId, date: anchorDate } = selectionAnchor;

      const resourceIds = resources.map(r => r.id);
      const anchorResourceIndex = resourceIds.indexOf(anchorResourceId);
      const currentResourceIndex = resourceIds.indexOf(resourceId);
      
      if (anchorResourceIndex === -1 || currentResourceIndex === -1) {
        setSelectionAnchor({ resourceId, date });
        setSelectedEventIds(clickedEventId ? [clickedEventId] : []);
        return;
      }

      const minResourceIndex = Math.min(anchorResourceIndex, currentResourceIndex);
      const maxResourceIndex = Math.max(anchorResourceIndex, currentResourceIndex);
      const selectedResourceIds = resourceIds.slice(minResourceIndex, maxResourceIndex + 1);

      const minDate = new Date(Math.min(anchorDate.getTime(), date.getTime()));
      const maxDate = new Date(Math.max(anchorDate.getTime(), date.getTime()));
      
      const selectedIds = events
        .filter(e => {
          if (!e.start || !e.resourceId || !e.className?.includes(EVENT_CLASS_NAME.ASSIGNMENT)) {
            return false;
          }
          const eventDate = new Date(e.start);
          const isResourceInRange = selectedResourceIds.includes(e.resourceId);
          const isDateInRange = eventDate >= minDate && eventDate <= maxDate;
          return isResourceInRange && isDateInRange;
        })
        .map(e => e.id);

      setSelectedEventIds(selectedIds);
    } else if (isCtrl && clickedEventId) {
      setSelectionAnchor({ resourceId, date });
      setSelectedEventIds(prev =>
        prev.includes(clickedEventId)
          ? prev.filter(id => id !== clickedEventId)
          : [...prev, clickedEventId]
      );
    } else {
      setSelectionAnchor({ resourceId, date });
      setSelectedEventIds(clickedEventId ? [clickedEventId] : []);
    }
  };

  const handleDateClick = (arg: any) => {
    if (!arg.resource) return;
    handleGridInteraction(arg.resource.id, arg.date, arg.jsEvent.shiftKey, arg.jsEvent.ctrlKey || arg.jsEvent.metaKey, null);
  };

  const handleEventClick = (clickInfo: any) => {
    const { event, jsEvent } = clickInfo;
    const resource = event.getResources()[0];

    if (!resource || !event.start) return;

    if (event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN)) {
      const projectData = { id: resource.id.replace(RESOURCE_PREFIX.PROJECT, ''), name: resource.title, bar_color: event.backgroundColor };
      setEditingProject(projectData);
      setProjectEditFormData({ name: projectData.name, bar_color: projectData.bar_color || '#3788d8' });
      setProjectEditDialogOpen(true);
      setSelectedEventIds([]);
      setSelectionAnchor(null);
      return;
    }
    
    handleGridInteraction(resource.id, new Date(event.start), jsEvent.shiftKey, jsEvent.ctrlKey || jsEvent.metaKey, event.id);
  };

  const handleSaveOtherAssignment = useCallback(async () => {
    if (!otherAssignmentTitle.trim()) {
      showNotification('予定名を入力してください。', 'warning');
      return;
    }
    const success = await handleAddOtherAssignment(otherAssignmentTitle, otherAssignmentDate, otherAssignmentResourceId);
    if (success) {
      setOtherAssignmentTitle('');
      handleCloseDialog();
    }
  }, [otherAssignmentTitle, otherAssignmentDate, otherAssignmentResourceId, handleAddOtherAssignment, showNotification, handleCloseDialog]);

  const handleDialogInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleProjectDialogInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProjectEditFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleColorChange = useCallback((color: ColorResult) => {
    setProjectEditFormData(prev => ({ ...prev, bar_color: color.hex }));
  }, []);

  const handleCloseNotification = useCallback((_?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  const handleSaveAssignment = useCallback(async () => {
    if (!editingEvent) return;
    const updatedEvent: CalendarEvent = { ...editingEvent, start: editFormData.start };
    const success = await handleEventUpdate(updatedEvent);
    if (success) {
      handleCloseDialog();
    }
  }, [editingEvent, editFormData, handleEventUpdate, handleCloseDialog]);

  const handleProjectUpdate = useCallback(async () => {
    if (!editingProject) return;
    const { error } = await supabase.from('Projects').update({ name: projectEditFormData.name, bar_color: projectEditFormData.bar_color }).eq('id', editingProject.id);
    if (error) {
      showNotification(`プロジェクトの更新に失敗しました: ${error.message}`, 'error');
    } else {
      await fetchData();
      showNotification('プロジェクトを更新しました。', 'success');
    }
    handleCloseDialog();
  }, [editingProject, projectEditFormData, showNotification, handleCloseDialog, fetchData]);

  const handleSaveReorder = async () => {
      await handleReorderAssignments(reorderableAssignments);
      handleCloseDialog();
  }

  const handleSaveResourceReorder = async () => {
    try {
      const tempUpdates = reorderableResources.map((resource, i) => {
        const idNum = Number(resource.id.replace(resource.group === 'projects' ? 'proj_' : 'work_', ''));
        const table = resource.group === 'projects' ? 'Projects' : 'Workers';
        return supabase.from(table).update({ display_order: -1 * (i + 1) }).eq('id', idNum);
      });
      const tempResults = await Promise.all(tempUpdates);
      for (const result of tempResults) {
        if (result.error) throw result.error;
      }
      const finalUpdates = reorderableResources.map((resource, i) => {
        const idNum = Number(resource.id.replace(resource.group === 'projects' ? 'proj_' : 'work_', ''));
        const table = resource.group === 'projects' ? 'Projects' : 'Workers';
        return supabase.from(table).update({ display_order: i }).eq('id', idNum);
      });
      const finalResults = await Promise.all(finalUpdates);
      for (const result of finalResults) {
        if (result.error) throw result.error;
      }
      await fetchData();
      handleCloseDialog();
      showNotification('表示順を更新しました。', 'success');
    } catch (error: any) {
      console.error('Error updating display_order:', error);
      showNotification(`表示順の更新中にエラーが発生しました: ${error.message}`, 'error');
      await fetchData();
    }
  };

  const handleEventDragStart = useCallback((dragInfo: any) => {
    const { event } = dragInfo;
    if (event.classNames.includes(EVENT_CLASS_NAME.ASSIGNMENT)) {
      const block = events.filter(e =>
        e.resourceId === event.resourceId &&
        e.start === event.startStr &&
        e.className?.includes(EVENT_CLASS_NAME.ASSIGNMENT)
      );
      setDraggedBlock(block);
    } else {
      setDraggedBlock([event]);
    }
  }, [events]);

  const handleEventAllow = useCallback((dropInfo: any, draggedEvent: any) => {
    if (lastHoveredCellRef.current) {
      lastHoveredCellRef.current.classList.remove('drop-invalid');
      lastHoveredCellRef.current = null;
    }

    const targetResourceId = dropInfo.resource.id;
    const targetDate = formatDate(dropInfo.start);

    if (!draggedEvent.classNames.includes(EVENT_CLASS_NAME.ASSIGNMENT) || !targetResourceId.startsWith(RESOURCE_PREFIX.WORKER)) {
      return true;
    }

    const currentCount = assignmentCounts.get(`${targetResourceId}_${targetDate}`) || 0;
    const draggedCount = draggedBlock.length > 0 ? draggedBlock.length : 1;

    const isAllowed = currentCount + draggedCount <= 3;

    if (!isAllowed) {
      const calendarEl = calendarRef.current?.getApi().el;
      if (calendarEl) {
        const cellSelector = `tr[data-resource-id='${targetResourceId}'] .fc-timeline-slot[data-date='${targetDate}']`;
        const cellEl = calendarEl.querySelector(cellSelector) as HTMLElement;
        if (cellEl) {
          cellEl.classList.add('drop-invalid');
          lastHoveredCellRef.current = cellEl;
        }
      }
    }

    return isAllowed;
  }, [assignmentCounts, draggedBlock, calendarRef]);

  const handleEventDragStop = useCallback(() => {
    if (lastHoveredCellRef.current) {
      lastHoveredCellRef.current.classList.remove('drop-invalid');
      lastHoveredCellRef.current = null;
    }
    setDraggedBlock([]);
  }, []);

  const handleEventMount = (mountInfo: any) => {
    const { event, el } = mountInfo;
    const isDummy = event.extendedProps.isDummy;
    const isAssignment = event.classNames.includes(EVENT_CLASS_NAME.ASSIGNMENT);

    if (isDummy) {
        el.style.backgroundColor = 'rgba(0,0,0,0.0)'; 
    }

    if (isDummy || isAssignment) {
        el.oncontextmenu = (e: MouseEvent) => {
            e.preventDefault();
            const props = {
                event: event,
                resource: isDummy ? event.extendedProps.resource : resources.find(r => r.id === event.resourceId),
                date: isDummy ? event.extendedProps.date : event.start
            };
            show({ event: e, props });
        };
    }
  };

  // --- EFFECTS ---
  useEffect(() => {
    const fetchCompanyHolidays = async () => {
      const { data, error } = await supabase.from('CompanyHolidays').select('*');
      if (error) {
        console.error('Error fetching company holidays:', error);
      } else {
        setCompanyHolidays(data as CompanyHoliday[]);
      }
    };
    fetchCompanyHolidays();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && !isCopyMode) {
        setIsCopyMode(true);
      }

      if (selectedEventIds.length > 0) {
        const selectedEvents = events.filter(event => selectedEventIds.includes(event.id));
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          handleAssignmentCopy(selectedEvents);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
          handleAssignmentCut(selectedEvents);
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          handleAssignmentDelete(selectedEvents);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && isCopyMode) {
        setIsCopyMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isCopyMode, selectedEventIds, events, handleAssignmentCopy, handleAssignmentCut, handleAssignmentDelete]);

  useEffect(() => {
    if (!loading && calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const view = calendarApi.view;
      const workerResources = resources.filter(r => r.id.startsWith(RESOURCE_PREFIX.WORKER));
      const newDummyEvents: CalendarEvent[] = [];

      for (let d = new Date(view.activeStart); d <= view.activeEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        workerResources.forEach(worker => {
          const hasEvent = events.some(e => e.resourceId === worker.id && e.start === dateStr && !e.extendedProps?.isDummy);
          if (!hasEvent) {
            newDummyEvents.push({
              id: `dummy_${worker.id}_${dateStr}`,
              title: '',
              resourceId: worker.id,
              start: dateStr,
              end: dateStr,
              display: 'background',
              extendedProps: { isDummy: true, resource: worker, date: new Date(dateStr) }
            });
          }
        });
      }
      setDummyEvents(newDummyEvents);
    }
  }, [events, resources, loading]);

  useEffect(() => {
    if (!loading && calendarRef.current) {
      calendarRef.current.getApi().gotoDate(new Date());
    }
  }, [loading]);

  useEffect(() => {
    if (dataError) {
      showNotification(`データの読み込みに失敗しました: ${dataError}`, 'error');
    }
  }, [dataError, showNotification]);

  // --- RENDER ---
  return (
    <div className={isCopyMode ? 'copy-mode' : ''}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>全体工程管理ボード</Typography>
        <Typography variant="h5" sx={{ flexGrow: 1, textAlign: 'center' }}>{calendarTitle}</Typography>
        <Box sx={{ display: 'flex', gap: 2, minWidth: '60px' }}>
          {(dataError || loading) && <IconButton onClick={() => fetchData()} disabled={loading} color="primary"><ReplayIcon /></IconButton>}
        </Box>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      ) : (
        <Paper sx={{ marginTop: 2, overflowX: 'auto' }}>
          <ScheduleCalendar
            calendarRef={calendarRef}
            resources={resources}
            events={displayEvents}
            companyHolidays={companyHolidays}
            selectedEventIds={selectedEventIds}
            onDatesSet={(arg) => setCalendarTitle(arg.view.title)}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            onEventDragStart={handleEventDragStart}
            onEventDragStop={handleEventDragStop}
            onEventAllow={handleEventAllow}
            onEventMount={handleEventMount}
            setReorderableResources={setReorderableResources}
            setReorderResourceDialogOpen={setReorderResourceDialogOpen}
          />
        </Paper>
      )}
      <ScheduleContextMenu
        clipboard={clipboard}
        events={events}
        selectedEventIds={selectedEventIds}
        handleAssignmentCopy={handleAssignmentCopy}
        handleAssignmentCut={handleAssignmentCut}
        handleAssignmentDelete={handleAssignmentDelete}
        setReorderableAssignments={setReorderableAssignments}
        setReorderDialogOpen={setReorderDialogOpen}
        setOtherAssignmentDate={setOtherAssignmentDate}
        setOtherAssignmentResourceId={setOtherAssignmentResourceId}
        setOtherAssignmentDialogOpen={setOtherAssignmentDialogOpen}
        handlePaste={handlePaste}
        handleBlockCopy={handleBlockCopy}
        handleBlockCut={handleBlockCut}
        handleBlockDelete={handleBlockDelete}
      />
      <Snackbar open={notification.open} autoHideDuration={6000} onClose={handleCloseNotification}>
        <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }} variant="filled">{notification.message}</Alert>
      </Snackbar>
      <ReorderAssignmentsDialog
        open={reorderDialogOpen}
        onClose={handleCloseDialog}
        assignments={reorderableAssignments}
        setAssignments={setReorderableAssignments}
        onSave={handleSaveReorder}
      />
      <ReorderResourcesDialog
        open={reorderResourceDialogOpen}
        onClose={handleCloseDialog}
        resources={reorderableResources}
        setResources={setReorderableResources}
        onSave={handleSaveResourceReorder}
      />
      <EditAssignmentDialog
        open={!!editingEvent}
        onClose={handleCloseDialog}
        event={editingEvent}
        formData={editFormData}
        onFormChange={handleDialogInputChange}
        onSave={handleSaveAssignment}
      />
      <EditProjectDialog
        open={projectEditDialogOpen}
        onClose={handleCloseDialog}
        formData={projectEditFormData}
        onFormChange={handleProjectDialogInputChange}
        onColorChange={handleColorChange}
        onSave={handleProjectUpdate}
      />
      <AddOtherAssignmentDialog
        open={otherAssignmentDialogOpen}
        onClose={handleCloseDialog}
        title={otherAssignmentTitle}
        onTitleChange={(e) => setOtherAssignmentTitle(e.target.value)}
        onSave={handleSaveOtherAssignment}
      />
    </div>
  );
}