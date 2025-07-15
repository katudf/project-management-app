import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Paper, CircularProgress, Alert, Typography, Box, Button, ButtonGroup } from '@mui/material';

import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import type { EventDropArg, EventContentArg } from '@fullcalendar/core'; // EventResizeDoneArgを削除
import jaLocale from '@fullcalendar/core/locales/ja';

// --- 型定義 ---
interface Resource {
  id: string;
  title: string;
  group: 'projects' | 'workers';
  order?: number;
  parentId?: string; 
}

interface CalendarEvent {
  id: string;
  resourceId: string;
  title: string;
  start: string;
  end?: string;
  className?: string;
  display?: 'background' | 'auto';
}

export default function OverallSchedulePage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ 
          { data: projectsData, error: projectsError },
          { data: tasksData, error: tasksError },
          { data: workersData, error: workersError },
          { data: assignmentsData, error: assignmentsError },
          { data: servicesData, error: servicesError }
        ] = await Promise.all([
          supabase.from('Projects').select('*').order('order'),
          supabase.from('ProjectTasks').select('*').order('order'),
          supabase.from('Workers').select('*').order('order'),
          supabase.from('Assignments').select('*'),
          supabase.from('ServiceMaster').select('id, name')
        ]);

        if (projectsError || tasksError || workersError || assignmentsError || servicesError) {
          throw new Error("データ取得に失敗しました。");
        }

        const serviceMap = new Map(servicesData.map(s => [s.id, s.name]));

        // 1. リソース（縦軸）の作成（階層構造）
        const projectResources: Resource[] = projectsData.map(p => ({
          id: `proj_${p.id}`,
          title: p.name || '名称未設定',
          group: 'projects',
          order: p.order,
        }));
        
        const taskResources: Resource[] = tasksData.map(t => ({
            id: `task_${t.id}`,
            parentId: `proj_${t.projectId}`,
            title: serviceMap.get(t.serviceMasterId) || '名称未設定',
            group: 'projects',
            order: t.order,
        }));

        const workerResources: Resource[] = workersData.map(w => ({
          id: `work_${w.id}`,
          title: w.name || '名称未設定',
          group: 'workers',
          order: w.order,
        }));
        
        setResources([...projectResources, ...taskResources, ...workerResources]);

        // 2. イベント（タイムライン上のバーや予定）の作成
        const projectBgEvents: CalendarEvent[] = projectsData.map(p => ({
            id: `proj_bg_${p.id}`,
            resourceId: `proj_${p.id}`,
            title: '',
            start: p.startDate,
            end: p.endDate,
            display: 'background',
            className: 'project-bg-event'
        }));
        
        const taskEvents: CalendarEvent[] = tasksData.map(t => ({
            id: `task_bar_${t.id}`,
            resourceId: `task_${t.id}`,
            title: serviceMap.get(t.serviceMasterId) || '',
            start: t.startDate,
            end: t.endDate,
            className: 'task-event',
        }));

        const assignmentEvents: CalendarEvent[] = assignmentsData.map(a => {
            const projectTask = tasksData.find(t => t.id === a.projectTaskId);
            const project = projectTask ? projectsData.find(p => p.id === projectTask.projectId) : undefined;
            return {
                id: `assign_${a.id}`,
                resourceId: `work_${a.workerId}`,
                title: project?.name || '未設定',
                start: a.date,
                className: 'assignment-event',
            }
        });

        setEvents([...projectBgEvents, ...taskEvents, ...assignmentEvents]);

      } catch (err: any) {
        console.error("エラー:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ★★リサイズ処理を削除し、ドロップ処理のみに★★
  const handleEventDrop = async (arg: EventDropArg) => {
    const { event, oldResource, newResource } = arg;
    const eventId = event.id;

    if (eventId.startsWith('assign_')) {
        const assignmentId = Number(eventId.replace('assign_', ''));
        const newWorkerId = Number((newResource || oldResource)?.id.replace('work_', ''));
        const newDate = event.startStr;

        const { error } = await supabase
            .from('Assignments')
            .update({ workerId: newWorkerId, date: newDate })
            .eq('id', assignmentId);
        
        if (error) {
            alert("人員配置の更新に失敗しました。");
            arg.revert();
        }
    } else if (eventId.startsWith('task_bar_')) {
        if (newResource && oldResource && newResource.id !== oldResource.id) {
            alert("作業バーは他の行に移動できません。");
            arg.revert();
            return;
        }
        const taskId = Number(eventId.replace('task_bar_', ''));
        const { error } = await supabase
            .from('ProjectTasks')
            .update({ 
                startDate: event.startStr,
                endDate: event.end ? new Date(event.end.getTime() - 1).toISOString().split('T')[0] : event.startStr
            })
            .eq('id', taskId);
        if (error) {
            alert("工期の更新に失敗しました。");
            arg.revert();
        }
    } else {
        arg.revert();
    }
  };
  
  const dailyAssignmentCount = new Map<string, number>();
  events.filter(e => e.className === 'assignment-event').forEach(e => {
      const key = `${e.resourceId}_${e.start}`;
      dailyAssignmentCount.set(key, (dailyAssignmentCount.get(key) || 0) + 1);
  });

  const renderEventContent = (eventInfo: EventContentArg) => {
    if (eventInfo.event.classNames.includes('assignment-event')) {
        const key = `${eventInfo.event.getResources()[0]?.id}_${eventInfo.event.startStr}`;
        const count = dailyAssignmentCount.get(key) || 1;
        
        let lineClamp = 1;
        if (count === 1) lineClamp = 4;
        else if (count === 2) lineClamp = 2;

        return (
            <div className="assignment-event-title" style={{ WebkitLineClamp: lineClamp }}>
                {eventInfo.event.title}
            </div>
        );
    }
    return <div className="event-title">{eventInfo.event.title}</div>;
  };
  
  const availableViews = ['resourceTimelineWeek', 'resourceTimelineMonth', 'resourceTimelineYear'];
  const [currentViewIndex, setCurrentViewIndex] = useState(1);

  const handleZoomIn = () => setCurrentViewIndex(prev => Math.max(0, prev - 1));
  const handleZoomOut = () => setCurrentViewIndex(prev => Math.min(availableViews.length - 1, prev + 1));

  useEffect(() => {
    calendarRef.current?.getApi().changeView(availableViews[currentViewIndex]);
  }, [currentViewIndex]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>全体工程管理ボード</Typography>
        <ButtonGroup variant="outlined">
          <Button onClick={handleZoomOut}>- 縮小</Button>
          <Button onClick={handleZoomIn}>+ 拡大</Button>
        </ButtonGroup>
      </Box>
      <Paper sx={{ mt: 2 }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimelinePlugin, interactionPlugin, dayGridPlugin]}
          schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
          locale={jaLocale}
          initialView={availableViews[currentViewIndex]}
          initialDate={new Date()}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          editable={true}
          resources={resources}
          resourceGroupField="group"
          resourceOrder="group,order"
          events={events}
          eventDrop={handleEventDrop}
          // eventResize={handleEventChange} // ★★リサイズ機能を一旦削除★★
          eventContent={renderEventContent}
          dayCellClassNames={ (arg) => {
            const day = arg.date.getDay();
            if (day === 0) return ['sunday'];
            if (day === 6) return ['saturday'];
            return [];
          }}
          slotMinWidth={60}
          resourceAreaWidth="250px"
        />
      </Paper>
      <style>{`
        /* 行の高さ調整 */
        .fc-resource-timeline .fc-timeline-lane[data-resource-id^="proj_"] .fc-timeline-lane-frame { min-height: 35px !important; }
        .fc-resource-timeline .fc-timeline-lane[data-resource-id^="task_"] .fc-timeline-lane-frame { height: 28px !important; }
        .fc-resource-timeline .fc-timeline-lane[data-resource-id^="work_"] .fc-timeline-lane-frame { height: 90px !important; }
        .fc-datagrid-cell[data-resource-id^="work_"] .fc-datagrid-cell-frame { height: 90px !important; }

        /* バー共通のスタイル */
        .fc-timeline-event.fc-event-main { 
            border-radius: 4px; 
            padding: 2px 4px; 
            height: 100%;
            box-sizing: border-box;
        }
        .event-title { 
            font-size: 12px; 
            color: white; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            line-height: 1.8;
        }
        
        /* バー個別の色 */
        .fc-event.project-main-event { background-color: transparent; border: none; }
        .fc-event.task-event { background-color: #3498db; border-color: #2980b9; }
        .fc-event.assignment-event { background-color: #2ecc71; border-color: #27ae60; }
        
        /* 人員配置イベントのスタイル */
        .assignment-event-title {
            padding: 2px 3px; font-size: 12px; line-height: 1.3;
            height: 100%; overflow: hidden; display: -webkit-box;
            -webkit-box-orient: vertical; text-overflow: ellipsis; word-break: break-all;
        }
        
        /* 曜日の色分けをより強く指定 */
        .fc-timeline-slot.saturday .fc-timeline-slot-lane, .fc-datagrid-cell.saturday { 
            background-color: #eaf4ff !important; 
        }
        .fc-timeline-slot.sunday .fc-timeline-slot-lane, .fc-datagrid-cell.sunday { 
            background-color: #ffe9e9 !important; 
        }
      `}</style>
    </div>
  );
}
