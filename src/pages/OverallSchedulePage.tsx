// src/pages/OverallSchedulePage.tsx
import { useEffect, useState, useRef, useMemo } from 'react';
import { Paper, CircularProgress, Alert, Typography, Box, Button, ButtonGroup, styled, Snackbar, IconButton, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Tooltip, Popover, List, ListItem, ListItemText, Menu, MenuItem, ListItemIcon, Divider } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import type { EventContentArg, EventClickArg, EventApi, DateClickArg } from '@fullcalendar/core';
import jaLocale from '@fullcalendar/core/locales/ja';
import ReplayIcon from '@mui/icons-material/Replay';
import { ContentCopy, ContentCut, Delete, ContentPaste } from '@mui/icons-material';

import { useScheduleData } from '@/hooks/useScheduleData';
import { useEventHandlers, type ClipboardData } from '@/hooks/useEventHandlers';
import { EVENT_CLASS_NAME } from '@/constants/scheduleConstants';
import type { CalendarEvent } from '@/types/schedule';
import { formatDate } from '@/utils/dateUtils';
import { getDayClasses } from '@/utils/uiUtils';

// スタイル付きコンポーネントの定義
const StyledCalendarWrapper = styled(Paper)(({ theme }) => ({
  marginTop: theme.spacing(2),
  overflowX: 'auto',
  '.fc-resource-timeline .fc-timeline-lane[data-resource-id^="proj_"] .fc-timeline-lane-frame': { height: '30px !important' },
  '.fc-resource-timeline .fc-timeline-lane[data-resource-id^="task_"] .fc-timeline-lane-frame': { height: '30px !important' },
  '.fc-resource-timeline .fc-timeline-lane[data-resource-id^="work_"] .fc-timeline-lane-frame': { height: '68px !important' },
  '.fc-datagrid-cell[data-resource-id^="proj_"] .fc-datagrid-cell-frame': { height: '30px !important' },
  '.fc-datagrid-cell[data-resource-id^="task_"] .fc-datagrid-cell-frame': { height: '30px !important' },
  '.fc-datagrid-cell[data-resource-id^="work_"] .fc-datagrid-cell-frame': { height: '68px !important' },
  '.fc-timeline-event.fc-event-main, .fc-timeline-event.fc-event-main .fc-event-main-frame': {
    borderRadius: '4px !important',
    overflow: 'hidden !important',
  },
  '.event-title': { fontSize: '12px', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 2.0 },
  '.fc-event.project-main-event': { backgroundColor: '#a9cce3', borderColor: '#5499c7', cursor: 'grab', '.event-title': { color: '#1a5276', fontWeight: 'bold' } },
  '.fc-event.task-event': { backgroundColor: '#3498db', borderColor: '#2980b9' },
  '.fc-event.assignment-event': { backgroundColor: '#2ecc71', borderColor: '#27ae60' },
  '.assignment-event-title': { padding: '2px 4px', fontSize: '10px', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis', wordBreak: 'break-word' },
  '.fc-timeline-slot.saturday .fc-timeline-slot-lane, .fc-datagrid-cell.saturday': { backgroundColor: '#eaf4ff !important' },
  '.fc-timeline-slot.sunday .fc-timeline-slot-lane, .fc-datagrid-cell.sunday, .fc-timeline-slot.holiday .fc-timeline-slot-lane, .fc-datagrid-cell.holiday': { backgroundColor: '#ffe9e9 !important' },
}));

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
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {title}
        </div>
    );
};

export default function OverallSchedulePage() {
  const { resources, events, setEvents, loading, error: dataError, fetchData } = useScheduleData();
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editFormData, setEditFormData] = useState<{
    title: string;
    start: string;
  }>({ title: '', start: '' });

  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [reorderableAssignments, setReorderableAssignments] = useState<CalendarEvent[]>([]);

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    targetEvent: CalendarEvent | null;
    targetDate: string;
    targetResourceId: string;
  } | null>(null);

  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);

  const [otherAssignmentDialogOpen, setOtherAssignmentDialogOpen] = useState(false);
  const [otherAssignmentTitle, setOtherAssignmentTitle] = useState('');
  const [otherAssignmentDate, setOtherAssignmentDate] = useState('');
  const [otherAssignmentResourceId, setOtherAssignmentResourceId] = useState('');

  const handleDialogInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  const showNotification = (
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning' = 'error'
  ) => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setNotification((prev) => ({ ...prev, open: false }));
  };
    const { handleEventDrop, handleEventResize, handleEventUpdate, handleAssignmentCopy, handleAssignmentCut, handleAssignmentDelete, handleBlockCopy, handleBlockCut, handleBlockDelete, handlePaste, handleAddOtherAssignment, handleReorderAssignments } = useEventHandlers(events, setEvents, resources, showNotification, clipboard, setClipboard, fetchData);

  const handleEventClick = (clickInfo: EventClickArg) => {
    const { jsEvent, event } = clickInfo;
    if (jsEvent.button !== 0) return; // Only handle left-clicks

    if (event.id.startsWith('assign_')) {
        jsEvent.preventDefault();
        const targetEvent = events.find(e => e.id === event.id) || null;
        setContextMenu({
            mouseX: jsEvent.clientX - 2,
            mouseY: jsEvent.clientY - 4,
            targetEvent: targetEvent,
            targetDate: event.startStr,
            targetResourceId: event.getResources()[0]?.id,
        });
    }
  };

  const handleDateClick = (dateInfo: DateClickArg) => {
      const { jsEvent, resource, dateStr } = dateInfo;
      if (jsEvent.button !== 0 || !resource?.id.startsWith('work_')) {
          return;
      }
      jsEvent.preventDefault();
      setContextMenu({
          mouseX: jsEvent.clientX - 2,
          mouseY: jsEvent.clientY - 4,
          targetEvent: null,
          targetDate: dateStr,
          targetResourceId: resource.id,
      });
  };

  const handleCloseDialog = () => {
    setEditingEvent(null);
    setOtherAssignmentDialogOpen(false);
    setReorderDialogOpen(false);
  };

  const handleSave = async () => {
    if (!editingEvent) return;
    const updatedEvent: CalendarEvent = { ...editingEvent, start: editFormData.start };
    const success = await handleEventUpdate(updatedEvent);
    if (success) {
      handleCloseDialog();
    }
  };

  const handleSaveOtherAssignment = async () => {
      if (!otherAssignmentTitle.trim()) {
          showNotification('予定名を入力してください。', 'warning');
          return;
      }
      await handleAddOtherAssignment(otherAssignmentTitle, otherAssignmentDate, otherAssignmentResourceId);
      handleCloseDialog();
  }

  const handleSaveReorder = async () => {
      await handleReorderAssignments(reorderableAssignments);
      handleCloseDialog();
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: any) {
    const {active, over} = event;
    
    if (active.id !== over.id) {
      setReorderableAssignments((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleMenuClick = (action: () => void) => {
    action();
    handleCloseContextMenu();
  };

  const renderContextMenu = () => {
    if (!contextMenu) return null;

    const { targetEvent, targetDate, targetResourceId } = contextMenu;
    const assignmentsOnDay = dailyAssignments.get(`${targetResourceId}_${targetDate}`) || [];
    const hasEvent = targetEvent !== null;
    const isSingleEventOnDay = assignmentsOnDay.length === 1;

    const handleEditOrViewClick = () => {
        if (assignmentsOnDay.length > 1) {
            setReorderableAssignments(assignmentsOnDay);
            setReorderDialogOpen(true);
        } else if (targetEvent) {
            setEditingEvent(targetEvent);
            setEditFormData({ title: targetEvent.title, start: targetEvent.start.split('T')[0] });
        }
    };

    const handleAddOtherClick = () => {
        setOtherAssignmentDate(targetDate);
        setOtherAssignmentResourceId(targetResourceId);
        setOtherAssignmentTitle('');
        setOtherAssignmentDialogOpen(true);
    };

    return (
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        {hasEvent && [
          <MenuItem key="edit-view" onClick={() => handleMenuClick(handleEditOrViewClick)}><ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>編集/並び替え</MenuItem>,
          <Divider key="divider-0" />
        ]}
        {hasEvent && isSingleEventOnDay && targetEvent && [
          <MenuItem key="copy-single" onClick={() => handleMenuClick(() => handleAssignmentCopy(targetEvent))}><ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>工事名コピー</MenuItem>,
          <MenuItem key="cut-single" onClick={() => handleMenuClick(() => handleAssignmentCut(targetEvent))}><ListItemIcon><ContentCut fontSize="small" /></ListItemIcon>工事名切り取り</MenuItem>,
          <MenuItem key="delete-single" onClick={() => handleMenuClick(() => handleAssignmentDelete(targetEvent))}><ListItemIcon><Delete fontSize="small" /></ListItemIcon>工事名削除</MenuItem>,
          <Divider key="divider-1" />
        ]}
        {assignmentsOnDay.length > 0 && [
          <MenuItem key="copy-block" onClick={() => handleMenuClick(() => handleBlockCopy(targetResourceId, targetDate))}><ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>ブロックコピー</MenuItem>,
          <MenuItem key="cut-block" onClick={() => handleMenuClick(() => handleBlockCut(targetResourceId, targetDate))}><ListItemIcon><ContentCut fontSize="small" /></ListItemIcon>ブロック切り取り</MenuItem>,
        ]}
        <MenuItem disabled={assignmentsOnDay.length === 0} onClick={() => handleMenuClick(() => handleBlockDelete(targetResourceId, targetDate))}><ListItemIcon><Delete fontSize="small" /></ListItemIcon>ブロック削除</MenuItem>
        <Divider />
        <MenuItem onClick={() => handleMenuClick(handleAddOtherClick)}><ListItemIcon><AddCircleOutlineIcon fontSize="small" /></ListItemIcon>その他予定を追加</MenuItem>
        <MenuItem
          disabled={!clipboard}
          onClick={() => handleMenuClick(() => handlePaste(targetResourceId, targetDate))}
        >
          <ListItemIcon><ContentPaste fontSize="small" /></ListItemIcon>
          貼り付け
        </MenuItem>
      </Menu>
    );
  };


  const calendarRef = useRef<FullCalendar | null>(null);

  const dailyAssignments = useMemo(() => {
    const assignmentsMap = new Map<string, CalendarEvent[]>();
    events.filter(e => e.className === EVENT_CLASS_NAME.ASSIGNMENT).forEach((e: CalendarEvent) => {
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
      (e) => e.className !== EVENT_CLASS_NAME.ASSIGNMENT
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

      if (sortedList.length > 3) {
        limitedAssignments.push(...sortedList.slice(0, 3));
      } else {
        limitedAssignments.push(...sortedList);
      }
    });

    return [...nonAssignmentEvents, ...limitedAssignments];
  }, [events, dailyAssignments]);

  const dailyAssignmentCount = useMemo(() => {
    const countMap = new Map<string, number>();
    displayEvents.filter(e => e.className === EVENT_CLASS_NAME.ASSIGNMENT).forEach((e: CalendarEvent) => {
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

      const individualTooltipContent = (
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle2" gutterBottom>{title}</Typography>
          <Typography variant="body2">日付: {start}</Typography>
        </Box>
      );

      let webkitLineClamp = 1;
      let fontSize = '10px';

      if (count === 1) {
        webkitLineClamp = 4;
        fontSize = '12px';
      } else if (count === 2) {
        webkitLineClamp = 2;
      }

      return (
          <div style={{ display: 'table', height: '100%', width: '100%' }}>
            <div style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'center' }}>
              <div
                className="assignment-event-title"
                style={{
                  WebkitLineClamp: webkitLineClamp,
                  fontSize: fontSize,
                }}
              >
                {title}
              </div>
            </div>
          </div>
      );
    }

    return (
      <Tooltip title={tooltipContent} placement="top" arrow>
        <div className="event-title">{eventInfo.event.title}</div>
      </Tooltip>
    );
  };

  const availableViews = useMemo(() => ['resourceTimelineWeek', 'resourceTimelineMonth', 'resourceTimelineYear'], []);
  const [currentViewIndex, setCurrentViewIndex] = useState(1);
  const handleZoomIn = () => setCurrentViewIndex(prev => Math.max(0, prev - 1));
  const handleZoomOut = () => setCurrentViewIndex(prev => Math.min(availableViews.length - 1, prev + 1));

  useEffect(() => {
    if (calendarRef.current) {
        calendarRef.current.getApi().changeView(availableViews[currentViewIndex]);
    }
  }, [currentViewIndex, availableViews]);

  useEffect(() => {
    if (!loading && calendarRef.current) {
      calendarRef.current.getApi().gotoDate(new Date());
    }
  }, [loading]);

  useEffect(() => {
    if (dataError) {
      showNotification(`データの読み込みに失敗しました: ${dataError}`, 'error');
    }
  }, [dataError]);

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>全体工程管理ボード</Typography>
        <ButtonGroup variant="outlined">
          <Button onClick={handleZoomOut}>- 縮小</Button>
          <Button onClick={handleZoomIn}>+ 拡大</Button>
          {(dataError || loading) && (
            <IconButton onClick={() => fetchData()} disabled={loading} color="primary">
              <ReplayIcon />
            </IconButton>
          )}
        </ButtonGroup>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      ) : (
        <StyledCalendarWrapper>
          <FullCalendar
            ref={calendarRef}
            plugins={[resourceTimelinePlugin, interactionPlugin, dayGridPlugin]}
            schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
            locale={jaLocale}
            initialView={availableViews[currentViewIndex]}
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
            eventContent={renderEventContent}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            dayCellClassNames={getDayClasses}
            slotMinWidth={60}
            resourceAreaWidth="250px"
            dragScroll={true}
          />
        </StyledCalendarWrapper>
      )}
      {renderContextMenu()}
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
      <Dialog open={!!editingEvent} onClose={handleCloseDialog}>
        <DialogTitle>配置情報の編集</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="title"
            name="title"
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