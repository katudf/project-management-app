// src/pages/OverallSchedulePage.tsx
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Paper, CircularProgress, Alert, Typography, Box, Button, Snackbar, IconButton, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Tooltip } from '@mui/material';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import type { EventContentArg, SlotLaneContentArg, EventClickArg } from '@fullcalendar/core';
import jaLocale from '@fullcalendar/core/locales/ja';
import ReplayIcon from '@mui/icons-material/Replay';

import { Menu, Item, useContextMenu } from 'react-contexify';
import 'react-contexify/dist/ReactContexify.css';

import { useScheduleData } from '@/hooks/useScheduleData';
import { useEventHandlers, type ClipboardData } from '@/hooks/useEventHandlers';
import { EVENT_CLASS_NAME } from '@/constants/scheduleConstants';
import type { CalendarEvent, Resource } from '@/types/schedule';
import { formatDate } from '@/utils/dateUtils';
import { getDayClasses } from '@/utils/uiUtils';
import { supabase } from '@/supabaseClient';
import { SketchPicker, type ColorResult } from 'react-color';

const EVENT_MENU_ID = 'event-menu';
const SLOT_MENU_ID = 'slot-menu';

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

export default function OverallSchedulePage() {
  // ダイアログ閉じる関数（依存配列で使うため先に宣言）
  // 依存state・関数を先に宣言
  const { resources, events, setEvents, loading, error: dataError, fetchData } = useScheduleData();
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const showNotification = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({ open: true, message, severity });
  }, []);

  // useEventHandlersの呼び出し
  const { handleEventDrop, handleEventResize, handleEventUpdate, handleAssignmentCopy, handleAssignmentCut, handleAssignmentDelete, handleBlockCopy, handleBlockCut, handleBlockDelete, handlePaste, handleAddOtherAssignment, handleReorderAssignments } = useEventHandlers(events, setEvents, resources, showNotification, clipboard, setClipboard, fetchData);

  // useEventHandlersの直後にダイアログ閉じる関数を宣言
  const handleCloseDialog = useCallback(() => {
    setEditingEvent(null);
    setOtherAssignmentDialogOpen(false);
    setReorderDialogOpen(false);
    setReorderResourceDialogOpen(false);
    setProjectEditDialogOpen(false);
    setEditingProject(null);
  }, []);

  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editFormData, setEditFormData] = useState<{
    title: string;
    start: string;
  }>({ title: '', start: '' });

  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [projectEditDialogOpen, setProjectEditDialogOpen] = useState(false);
  const [projectEditFormData, setProjectEditFormData] = useState<{
    name: string;
    bar_color: string;
  }>({ name: '', bar_color: '' });

  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [reorderableAssignments, setReorderableAssignments] = useState<CalendarEvent[]>([]);

  const [reorderResourceDialogOpen, setReorderResourceDialogOpen] = useState(false);
  const [reorderableResources, setReorderableResources] = useState<Resource[]>([]);


  const [otherAssignmentDialogOpen, setOtherAssignmentDialogOpen] = useState(false);
  const [otherAssignmentTitle, setOtherAssignmentTitle] = useState('');
  const [otherAssignmentDate, setOtherAssignmentDate] = useState('');
  const [otherAssignmentResourceId, setOtherAssignmentResourceId] = useState('');

  // ...existing code...

  const { show: showEventMenu } = useContextMenu({
    id: EVENT_MENU_ID,
  });
  const { show: showSlotMenu } = useContextMenu({
    id: SLOT_MENU_ID,
  });



  // その他予定の保存処理（useEventHandlersの後に定義）
  const handleSaveOtherAssignment = useCallback(async () => {
    if (!otherAssignmentTitle.trim()) {
      showNotification('予定名を入力してください。', 'warning');
      return;
    }
    await handleAddOtherAssignment(otherAssignmentTitle, otherAssignmentDate, otherAssignmentResourceId);
    handleCloseDialog();
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
    const { error } = await supabase
      .from('Projects')
      .update({ name: projectEditFormData.name, bar_color: projectEditFormData.bar_color })
      .eq('id', editingProject.id);

    if (error) {
      showNotification(`プロジェクトの更新に失敗しました: ${error.message}`, 'error');
          <FullCalendar
            ref={calendarRef}
            key={resources.map(r => r.id).join('-')}
            plugins={[resourceTimelinePlugin, interactionPlugin, dayGridPlugin]}
            schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
            locale={jaLocale}
            initialView='resourceTimelineMonth'
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
            editable={true}
            resources={resources}
            resourceGroupField="group"
            resourceOrder="group,order"
            events={displayEvents}
            eventOrder="extendedProps.assignment_order"
            eventResizableFromStart={true}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            // eventClick={handleEventClick}
            eventContent={renderEventContent}
            resourceAreaColumns={[{
              field: 'title',
              headerContent: 'Resources',
              cellContent: (colArg) => {
                // FullCalendar v6: colArg.resourceに本来のリソースオブジェクトが入る
                const res = colArg.resource;
                if (!res) return null;
                const group = res.extendedProps?.group;
                const isFirst = res.extendedProps?.order === 0;
                if (isFirst && (group === 'projects' || group === 'workers')) {
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{ mr: 1, fontSize: '0.75rem', minWidth: 0, p: '2px 6px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const filtered = resources.filter(r => r.group === group);
                          setReorderableResources(filtered);
                          setReorderResourceDialogOpen(true);
                        }}
                      >{group === 'projects' ? '案件名並び替え' : '作業員名並び替え'}</Button>
                      <span>{res.title}</span>
                    </Box>
                  );
                }
                return <span>{res.title}</span>;
              }
            }]} 
            slotLaneDidMount={(info) => {
              const classes = getDayClasses({ date: info.date } as any);
              classes.forEach((cls: string) => info.el.classList.add(cls));
            }}
            slotLabelDidMount={(info) => {
              const classes = getDayClasses({ date: info.date } as any);
              classes.forEach((cls: string) => info.el.classList.add(cls));
            }}
            slotMinWidth={60}
            resourceAreaWidth="250px"
            dragScroll={true}
          />
    }
    await handleAddOtherAssignment(otherAssignmentTitle, otherAssignmentDate, otherAssignmentResourceId);
    handleCloseDialog();
  }, [otherAssignmentTitle, otherAssignmentDate, otherAssignmentResourceId, handleAddOtherAssignment, showNotification, handleCloseDialog]);

  const handleSaveReorder = async () => {
      await handleReorderAssignments(reorderableAssignments);
      handleCloseDialog();
  }


  const handleSaveResourceReorder = async () => {
    // 並び替えた順にdisplay_orderを更新（Promise.allで並列化）
    const updates = reorderableResources.map((resource, i) => {
      const idNum = Number(resource.id.replace(resource.group === 'projects' ? 'proj_' : 'work_', ''));
      const table = resource.group === 'projects' ? 'Projects' : 'Workers';
      return supabase.from(table).update({ display_order: i }).eq('id', idNum);
    });
    await Promise.all(updates);
    await fetchData();
    handleCloseDialog();
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const dailyAssignments = useMemo(() => {
    const assignmentsMap = new Map<string, CalendarEvent[]>();
    events.filter((e: CalendarEvent) => e.className === EVENT_CLASS_NAME.ASSIGNMENT).forEach((e: CalendarEvent) => {
      const key = `${e.resourceId}_${e.start}`;
      if (!assignmentsMap.has(key)) {
        assignmentsMap.set(key, []);
      }
      assignmentsMap.get(key)!.push(e);
    });
    return assignmentsMap;
  }, [events]);

  const displayEvents = useMemo(() => {
    const nonAssignmentEvents = events.filter(
      (e: CalendarEvent) => e.className !== EVENT_CLASS_NAME.ASSIGNMENT
    );

    const limitedAssignments: CalendarEvent[] = [];
    dailyAssignments.forEach((eventList) => {
      const sortedList = [...eventList].sort((a, b) => {
        const orderA = a.extendedProps?.assignment_order;
        const orderB = b.extendedProps?.assignment_order;

        if (orderA === null || orderA === undefined) return 1;
        if (orderB === null || orderB === undefined) return -1;

        return orderA - orderB;
      });

      const listToProcess = sortedList.length > 3 ? sortedList.slice(0, 3) : sortedList;
      const count = listToProcess.length;
      const heightClass = `assignment-count-${count}`;

      const styledList = listToProcess.map((e: CalendarEvent) => ({
        ...e,
        className: `${e.className || ''} ${heightClass}`.trim()
      }));

      limitedAssignments.push(...styledList);
    });

    return [...nonAssignmentEvents, ...limitedAssignments];
  }, [events, dailyAssignments]);

  const dailyAssignmentCount = useMemo(() => {
    const countMap = new Map<string, number>();
    displayEvents.filter((e: CalendarEvent) => e.className === EVENT_CLASS_NAME.ASSIGNMENT).forEach((e: CalendarEvent) => {
      const key = `${e.resourceId}_${e.start}`;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    });
    return countMap;
  }, [displayEvents]);

  const renderEventContent = (eventInfo: EventContentArg) => {
    const { event } = eventInfo;
    const title = event.title;
    const start = formatDate(event.startStr);
    const end = event.end ? formatDate(new Date(event.end.getTime() - 86400000).toISOString()) : start;

    const tooltipContent = (
      <Box sx={{ p: 1 }}>
        <Typography variant="subtitle2" gutterBottom>{title.split(' (')[0]}</Typography>
        <Typography variant="body2">期間: {start} ~ {end}</Typography>
      </Box>
    );

    if (event.classNames.includes(EVENT_CLASS_NAME.ASSIGNMENT)) {
      const key = `${event.getResources()[0]?.id}_${event.startStr}`;
      const count = dailyAssignmentCount.get(key) || 1;

      let fontSize = '10px';

      if (count === 1) {
        fontSize = '12px';
      }

      return (
          <div onContextMenu={(e) => showEventMenu({ event: e, props: { event: eventInfo.event }})} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', textAlign: 'center' }}>
            <div
              className="assignment-event-title"
              style={{
                fontSize: fontSize,
              }}
            >
              {title}
            </div>
          </div>
      );
    }

    return (
      <Tooltip title={tooltipContent} placement="top" arrow>
        <div onContextMenu={(e) => showEventMenu({ event: e, props: { event: eventInfo.event }})} className="event-title">{eventInfo.event.title}</div>
      </Tooltip>
    );
  };

  useEffect(() => {
    if (!loading && calendarRef.current) {
      calendarRef.current.getApi().gotoDate(new Date());
    }
  }, [loading]);


  useEffect(() => {
    // 土曜
    document.querySelectorAll('td.fc-timeline-slot.saturday').forEach((el) => {
      (el as HTMLElement).style.backgroundColor = '#f0f8ff';
    });
    // 日曜
    document.querySelectorAll('td.fc-timeline-slot.sunday').forEach((el) => {
      (el as HTMLElement).style.backgroundColor = '#fff0f0';
    });
    // 祝日
    document.querySelectorAll('td.fc-timeline-slot.holiday').forEach((el) => {
      (el as HTMLElement).style.backgroundColor = '#fff0f0';
    });
  });

  useEffect(() => {
    if (dataError) {
      showNotification(`データの読み込みに失敗しました: ${dataError}`, 'error');
    }
  }, [dataError]);

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>全体工程管理ボード</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" color="primary" onClick={() => {
            setReorderableResources(resources);
            setReorderResourceDialogOpen(true);
          }}>
            リソースの並び替え
          </Button>
          {(dataError || loading) && (
            <IconButton onClick={() => fetchData()} disabled={loading} color="primary">
              <ReplayIcon />
            </IconButton>
          )}
        </Box>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      ) : (
        <Paper sx={{ marginTop: 2, overflowX: 'auto' }}>
          <FullCalendar
            ref={calendarRef}
            key={resources.map(r => r.id).join('-')}
            plugins={[resourceTimelinePlugin, interactionPlugin, dayGridPlugin]}
            schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
            locale={jaLocale}
            initialView='resourceTimelineMonth'
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
            editable={true}
            resources={resources}
            resourceGroupField="group"
            resourceOrder="group,order"
            events={displayEvents}
            eventOrder="extendedProps.assignment_order"
            eventResizableFromStart={true}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            // eventClick={handleEventClick}
            eventContent={renderEventContent}
            slotLaneContent={(info: SlotLaneContentArg & { resource?: any }) => {
              // 案件名・作業員名グループの先頭セルに並び替えボタンを表示
              if (!info.resource) return null;
              const group = info.resource.group;
              // 先頭セル判定: display_orderが0のリソース
              const isFirst = info.resource.order === 0;
              if (isFirst && (group === 'projects' || group === 'workers')) {
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ mr: 1, fontSize: '0.75rem', minWidth: 0, p: '2px 6px' }}
                      onClick={() => {
                        const filtered = resources.filter(r => r.group === group);
                        setReorderableResources(filtered);
                        setReorderResourceDialogOpen(true);
                      }}
                    >{group === 'projects' ? '案件名並び替え' : '作業員名並び替え'}</Button>
                  </Box>
                );
              }
              // 通常セルは右クリックメニューのみ
              return <div onContextMenu={(e) => showSlotMenu({ event: e, props: { resource: info.resource, date: info.date }})} style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent'}}></div>;
            }}
            slotLaneDidMount={(info) => {
              const classes = getDayClasses({ date: info.date } as any);
              classes.forEach((cls: string) => info.el.classList.add(cls));
            }}
            slotLabelDidMount={(info) => {
              const classes = getDayClasses({ date: info.date } as any);
              classes.forEach((cls: string) => info.el.classList.add(cls));
            }}
            slotMinWidth={60}
            resourceAreaWidth="250px"
            dragScroll={true}
          />
        </Paper>
      )}
      <Menu id={EVENT_MENU_ID}>
        <Item onClick={({props}) => {handleAssignmentCopy(props.event)}}>工事名コピー</Item>
        <Item onClick={({props}) => {handleAssignmentCut(props.event)}}>工事名切り取り</Item>
        <Item onClick={({props}) => {handleAssignmentDelete(props.event)}}>工事名削除</Item>
      </Menu>
      <Menu id={SLOT_MENU_ID}>
        <Item onClick={({ props }) => { props?.resource && handleBlockCopy(props.resource.id, formatDate(props.date.toISOString())) }}>ブロックコピー</Item>
        <Item onClick={({ props }) => { props?.resource && handleBlockCut(props.resource.id, formatDate(props.date.toISOString())) }}>ブロック切り取り</Item>
        <Item onClick={({ props }) => { props?.resource && handleBlockDelete(props.resource.id, formatDate(props.date.toISOString())) }}>ブロック削除</Item>
        <Item onClick={({ props }) => { if (props?.resource) { setOtherAssignmentDate(formatDate(props.date.toISOString())); setOtherAssignmentResourceId(props.resource.id); setOtherAssignmentDialogOpen(true); } }}>その他予定を追加</Item>
        <Item disabled={!clipboard} onClick={({ props }) => { props?.resource && handlePaste(props.resource.id, formatDate(props.date.toISOString())) }}>貼り付け</Item>
      </Menu>
      <Snackbar open={notification.open} autoHideDuration={6000} onClose={handleCloseNotification}>
        <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }} variant="filled">
          {notification.message}
        </Alert>
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
              {reorderableResources.map(item => (
                <SortableItem key={item.id} id={item.id} title={item.title} />
              ))}
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
          <TextField
            autoFocus
            margin="dense"
            id="title"
            name="name"
            label="案件名"
            type="text"
            fullWidth
            variant="standard"
            value={editFormData.title}
            disabled
          />
          <TextField
            margin="dense"
            id="start"
            name="start"
            label="日付"
            type="date"
            fullWidth
            variant="standard"
            value={editFormData.start}
            onChange={handleDialogInputChange}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={projectEditDialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>プロジェクトの編集</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            name="name"
            label="案件名"
            type="text"
            fullWidth
            variant="standard"
            value={projectEditFormData.name}
            onChange={handleProjectDialogInputChange}
          />
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
          <TextField
            autoFocus
            margin="dense"
            id="other-title"
            label="予定名"
            type="text"
            fullWidth
            variant="standard"
            value={otherAssignmentTitle}
            onChange={(e) => setOtherAssignmentTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button onClick={handleSaveOtherAssignment}>保存</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
