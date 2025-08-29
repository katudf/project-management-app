// src/pages/OverallSchedulePage.tsx
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Paper, CircularProgress, Alert, Typography, Box, Button, Snackbar, IconButton, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Tooltip } from '@mui/material';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';

import type { EventContentArg, EventMountArg } from '@fullcalendar/core';
import jaLocale from '@fullcalendar/core/locales/ja';
import ReplayIcon from '@mui/icons-material/Replay';

import { Menu, Item, useContextMenu, type ItemParams } from 'react-contexify';
import 'react-contexify/dist/ReactContexify.css';

import { useScheduleData } from '@/hooks/useScheduleData';
import { useEventHandlers, type ClipboardData } from '@/hooks/useEventHandlers';
import { EVENT_CLASS_NAME, RESOURCE_PREFIX } from '@/constants/scheduleConstants';
import type { CalendarEvent, Resource } from '@/types/schedule';
import { formatDate } from '@/utils/dateUtils';
import { getDayClasses } from '@/utils/uiUtils';
import { supabase } from '@/supabaseClient';
import { SketchPicker, type ColorResult } from 'react-color';

const CONTEXT_MENU_ID = 'context-menu';

const SortableItem = ({ id, title }: { id: string, title: string }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        padding: '8px 16px',
        border: '1px solid #ddd',
        marginBottom: '4px',
        backgroundColor: 'white',
        cursor: 'grab',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <span>{title}</span>
        </div>
    );
};

import CompanyHolidaysForm from '@/components/forms/CompanyHolidaysForm';

interface CompanyHoliday {
  id: number;
  date: string;
  description: string;
}

export default function OverallSchedulePage() {
  const { resources, events, setEvents, loading, error: dataError, fetchData } = useScheduleData();
  const [calendarTitle, setCalendarTitle] = useState('');
  const [companyHolidays, setCompanyHolidays] = useState<CompanyHoliday[]>([]);
  const [companyHolidaysFormOpen, setCompanyHolidaysFormOpen] = useState(false);

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
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning'; }>({ open: false, message: '', severity: 'info' });
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const showNotification = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({ open: true, message, severity });
  }, []);

  const { handleEventDrop, handleEventResize, handleEventUpdate, handleAssignmentCopy, handleAssignmentCut, handleAssignmentDelete, handleBlockCopy, handleBlockCut, handleBlockDelete, handlePaste, handleAddOtherAssignment, handleReorderAssignments } = useEventHandlers(events, setEvents, resources, showNotification, clipboard, setClipboard, fetchData);

  const handleCloseDialog = useCallback(() => {
    setEditingEvent(null);
    setOtherAssignmentDialogOpen(false);
    setReorderDialogOpen(false);
    setReorderResourceDialogOpen(false);
    setProjectEditDialogOpen(false);
    setEditingProject(null);
  }, []);

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

  const { show } = useContextMenu({ id: CONTEXT_MENU_ID });

  const handleEventClick = (clickInfo: any) => {
    const { event } = clickInfo;
    if (event.classNames.includes(EVENT_CLASS_NAME.PROJECT_MAIN)) {
      const associatedResources = event.getResources();
      if (associatedResources.length > 0) {
        const resource = associatedResources[0];
        const projectData = { id: resource.id.replace(RESOURCE_PREFIX.PROJECT, ''), name: resource.title, bar_color: event.backgroundColor };
        setEditingProject(projectData);
        setProjectEditFormData({ name: projectData.name, bar_color: projectData.bar_color || '#3788d8' });
        setProjectEditDialogOpen(true);
      } else {
        console.error('Resource not found for event:', event);
      }
    }
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

  const handleSave = useCallback(async () => {
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
    }
    await handleAddOtherAssignment(otherAssignmentTitle, otherAssignmentDate, otherAssignmentResourceId);
    handleCloseDialog();
  }, [otherAssignmentTitle, otherAssignmentDate, otherAssignmentResourceId, handleAddOtherAssignment, showNotification, handleCloseDialog]);

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

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    if (over && active.id !== over.id) {
      setReorderableAssignments((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function handleResourceDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    if (over && active.id !== over.id) {
      setReorderableResources((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const calendarRef = useRef<FullCalendar | null>(null);

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

  const renderEventContent = (eventInfo: EventContentArg) => {
    if (eventInfo.event.extendedProps.isDummy) return true;
    const { event } = eventInfo;
    const title = event.title;
    const isAssignment = event.classNames.includes(EVENT_CLASS_NAME.ASSIGNMENT);
    const className = isAssignment ? "assignment-event-title" : "event-title";
    return <div className={className}>{title}</div>;
  };

  const handleEventMount = (mountInfo: EventMountArg) => {
    const isDummy = mountInfo.event.extendedProps.isDummy;
    const isAssignment = mountInfo.event.classNames.includes(EVENT_CLASS_NAME.ASSIGNMENT);

    if (isDummy) {
        mountInfo.el.style.backgroundColor = 'rgba(0,0,0,0.0)'; 
    }

    if (isDummy || isAssignment) {
        mountInfo.el.oncontextmenu = (e) => {
            e.preventDefault();
            const props = {
                event: mountInfo.event,
                resource: isDummy ? mountInfo.event.extendedProps.resource : resources.find(r => r.id === mountInfo.event.resourceId),
                date: isDummy ? mountInfo.event.extendedProps.date : mountInfo.event.start
            };
            show({ event: e, props });
        };
    }
  };

  useEffect(() => {
    if (!loading && calendarRef.current) {
      calendarRef.current.getApi().gotoDate(new Date());
    }
  }, [loading]);

    useEffect(() => {
    // Cell styling is handled in App.css
  });

  useEffect(() => {
    if (dataError) {
      showNotification(`データの読み込みに失敗しました: ${dataError}`, 'error');
    }
  }, [dataError]);

  const isAssignment = (props: ItemParams) => props?.event?.classNames.includes(EVENT_CLASS_NAME.ASSIGNMENT);
  const isDummy = (props: ItemParams) => !!props?.event?.extendedProps.isDummy;
  const getAssignmentsOnDay = (props: ItemParams) => {
      if (!props) return [];
      const date = props.date ? formatDate(new Date(props.date).toISOString()) : props.event?.startStr;
      const resourceId = props.resource?.id || props.event?.getResources()[0]?.id;
      if (!date || !resourceId) return [];
      return events.filter(e => e.start === date && e.resourceId === resourceId && e.className === EVENT_CLASS_NAME.ASSIGNMENT);
  };

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>全体工程管理ボード</Typography>
        <Typography variant="h5" sx={{ flexGrow: 1, textAlign: 'center' }}>{calendarTitle}</Typography>
        <Button variant="outlined" onClick={() => setCompanyHolidaysFormOpen(true)}>休業日設定</Button>
        <Box sx={{ display: 'flex', gap: 2, minWidth: '60px' }}>
          {(dataError || loading) && <IconButton onClick={() => fetchData()} disabled={loading} color="primary"><ReplayIcon /></IconButton>}
        </Box>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      ) : (
        <Paper sx={{ marginTop: 2, overflowX: 'auto' }}>
          <FullCalendar
            ref={calendarRef}
            key={resources.map(r => r.id).join('-')}
            plugins={[resourceTimelinePlugin, interactionPlugin]}
            schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
            locale={jaLocale}
            initialView='resourceTimelineWeekRange'
            visibleRange={(() => {
              const today = new Date();
              const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
              const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Calculate days to subtract to get to Monday
              const mondayOfCurrentWeek = new Date(today.setDate(today.getDate() - diff));
              const sixMonthsLater = new Date(mondayOfCurrentWeek);
              sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
              return {
                start: mondayOfCurrentWeek.toISOString().split('T')[0],
                end: sixMonthsLater.toISOString().split('T')[0]
              };
            })()}
            headerToolbar={{ left: '', center: '', right: '' }}
            datesSet={(arg) => {
              setCalendarTitle(arg.view.title);
            }}
            views={{
              resourceTimelineWeekRange: {
                type: 'resourceTimeline',
                intervalDuration: { weeks: 1 },
                buttonText: '6ヶ月'
              },
              /*resourceTimelineSixMonths: {
                type: 'resourceTimeline',
                duration: { months: 6 },
                buttonText: '6ヶ月'
              }*/
            }}
            editable={true}
            resources={resources}
            resourceGroupField="group"
            resourceOrder="group,order"
            events={displayEvents}
            eventOrder="extendedProps.assignment_order"
            eventResizableFromStart={true}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventContent={renderEventContent}
            eventDidMount={handleEventMount}
            eventClick={handleEventClick}
            resourceAreaColumns={[
              {
                headerContent: 'リソース名',
                cellContent: (arg) => {
                  console.log('Resource object in cellContent:', arg.resource);

                  const { resource } = arg;
                  if (resource._resource.extendedProps && resource._resource.extendedProps.group === 'workers') {
                    const { birthDate, age } = resource._resource.extendedProps;
                    const birthDateStr = birthDate ? new Date(birthDate).toLocaleDateString('ja-JP') : '';
                    const ageStr = age !== undefined ? `(${age}歳)` : '';
                    return (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', p: '4px', height: '100%', justifyContent: 'center' }}>
                        <Typography variant="body2">{resource.title}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {birthDateStr} {ageStr}
                        </Typography>
                      </Box>
                    );
                  }
                  return <Box sx={{ p: '4px', display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'flex-start' }}><Typography variant="body2">{resource.title}</Typography></Box>;
                }
              }
            ]}
            resourceGroupLabelContent={(groupInfo) => (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexGrow: 1, pl: 1 }}>
                <Typography variant="subtitle2">{groupInfo.groupValue === 'projects' ? '案件名' : '作業員名'}</Typography>
                <Button size="small" variant="outlined" sx={{ fontSize: '0.75rem', minWidth: 0, p: '2px 6px', ml: '2em' }} onClick={() => {
                  const filtered = resources.filter(r => r.group === groupInfo.groupValue);
                  setReorderableResources(filtered);
                  setReorderResourceDialogOpen(true);
                }}>並び替え</Button>
              </Box>
            )}
            slotLaneDidMount={(info) => getDayClasses({ date: info.date } as any, companyHolidays).forEach(cls => info.el.classList.add(cls))}
            slotLabelDidMount={(info) => getDayClasses({ date: info.date } as any, companyHolidays).forEach(cls => info.el.classList.add(cls))}
            slotMinWidth={60}
            resourceAreaWidth="250px"
            dragScroll={true}
          />
        </Paper>
      )}
      <Menu id={CONTEXT_MENU_ID}>
        <Item hidden={({props}) => isDummy(props) || !isAssignment(props)} onClick={({props}) => handleAssignmentCopy(props.event)}>工事名コピー</Item>
        <Item hidden={({props}) => isDummy(props) || !isAssignment(props)} onClick={({props}) => handleAssignmentCut(props.event)}>工事名切り取り</Item>
        <Item hidden={({props}) => isDummy(props) || !isAssignment(props)} onClick={({props}) => handleAssignmentDelete(props.event)}>工事名削除</Item>
        <Item hidden={({props}) => getAssignmentsOnDay(props).length <= 1} onClick={({props}) => {
            const assignments = getAssignmentsOnDay(props);
            const sorted = [...assignments].sort((a, b) => (a.extendedProps?.assignment_order ?? 0) - (b.extendedProps?.assignment_order ?? 0));
            setReorderableAssignments(sorted);
            setReorderDialogOpen(true);
        }}>この日の作業順を並び替え</Item>
        <Item onClick={({props}) => {
            const date = props.date ? formatDate(new Date(props.date).toISOString()) : props.event.startStr;
            const resourceId = props.resource?.id || props.event.getResources()[0]?.id;
            setOtherAssignmentDate(date);
            setOtherAssignmentResourceId(resourceId);
            setOtherAssignmentDialogOpen(true);
        }}>その他予定を追加</Item>
        <Item disabled={!clipboard} onClick={({props}) => {
            const date = props.date ? formatDate(new Date(props.date).toISOString()) : props.event.startStr;
            const resourceId = props.resource?.id || props.event.getResources()[0]?.id;
            handlePaste(resourceId, date);
        }}>工事名の貼付け</Item>
        <Item hidden={({props}) => !isDummy(props)} onClick={({props}) => handleBlockCopy(props.resource.id, formatDate(props.date.toISOString()))}>ブロックコピー</Item>
        <Item hidden={({props}) => !isDummy(props)} onClick={({props}) => handleBlockCut(props.resource.id, formatDate(props.date.toISOString()))}>ブロック切り取り</Item>
        <Item hidden={({props}) => !isDummy(props)} onClick={({props}) => handleBlockDelete(props.resource.id, formatDate(props.date.toISOString()))}>ブロック削除</Item>
      </Menu>
      <Snackbar open={notification.open} autoHideDuration={6000} onClose={handleCloseNotification}>
        <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }} variant="filled">{notification.message}</Alert>
      </Snackbar>
      <Dialog open={reorderDialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>表示順の変更</DialogTitle>
        <DialogContent>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={reorderableAssignments.map(item => item.id)} strategy={verticalListSortingStrategy}>
                    {reorderableAssignments.map(item => <SortableItem key={item.id} id={item.id} title={item.title} />)}
                </SortableContext>
            </DndContext>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button onClick={handleSaveReorder}>保存</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={reorderResourceDialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>リソースの並び替え</DialogTitle>
        <DialogContent>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleResourceDragEnd}>
            <SortableContext items={reorderableResources.map(item => item.id)} strategy={verticalListSortingStrategy}>
              {reorderableResources.map(item => <SortableItem key={item.id} id={item.id} title={item.title} />)}
            </SortableContext>
          </DndContext>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button onClick={handleSaveResourceReorder}>保存</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!editingEvent} onClose={handleCloseDialog}>
        <DialogTitle>配置情報の編集</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" id="title" name="name" label="案件名" type="text" fullWidth variant="standard" value={editFormData.title} disabled />
          <TextField margin="dense" id="start" name="start" label="日付" type="date" fullWidth variant="standard" value={editFormData.start} onChange={handleDialogInputChange} InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={projectEditDialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>プロジェクトの編集</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" id="name" name="name" label="案件名" type="text" fullWidth variant="standard" value={projectEditFormData.name} onChange={handleProjectDialogInputChange} />
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1">バーの色</Typography>
            <SketchPicker color={projectEditFormData.bar_color} onChange={handleColorChange} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button onClick={handleProjectUpdate}>保存</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={otherAssignmentDialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>その他予定の追加</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" id="other-title" label="予定名" type="text" fullWidth variant="standard" value={otherAssignmentTitle} onChange={(e) => setOtherAssignmentTitle(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button onClick={handleSaveOtherAssignment}>保存</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={companyHolidaysFormOpen} onClose={() => setCompanyHolidaysFormOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>会社の休業日設定</DialogTitle>
        <DialogContent>
          <CompanyHolidaysForm />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompanyHolidaysFormOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}