import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Paper, CircularProgress, Alert, Typography, Box, Button, ButtonGroup } from '@mui/material';

import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
// ★★ 1. 不要な EventResizeDoneArg を削除 ★★
import type { EventDropArg, EventContentArg } from '@fullcalendar/core';
import jaLocale from '@fullcalendar/core/locales/ja';
import * as holiday_jp from '@holiday-jp/holiday_jp';

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
}

// --- ヘルパー関数 ---
const getDayClasses = (date: Date): string[] => {
  const classNames = [];
  if (holiday_jp.isHoliday(date)) classNames.push('holiday');
  else {
    const day = date.getDay();
    if (day === 0) classNames.push('sunday');
    if (day === 6) classNames.push('saturday');
  }
  return classNames;
};

const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
const getDuration = (start: string, end: string) => {
    const diffTime = new Date(end).getTime() - new Date(start).getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default function OverallSchedulePage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ★★ 10. useRefの型をより正確に修正 ★★
  const calendarRef = useRef<FullCalendar | null>(null);

  const fetchData = async () => {
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

      if (projectsError || tasksError || workersError || servicesError || assignmentsError) {
        throw new Error("データ取得に失敗しました。");
      }

      const serviceMap = new Map(servicesData.map(s => [s.id, s.name]));
      const projectMap = new Map(projectsData.map(p => [p.id, p.name]));

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

      const projectMainEvents: CalendarEvent[] = projectsData.map(p => {
          const endDate = new Date(p.endDate);
          endDate.setDate(endDate.getDate() + 1);
          const duration = getDuration(p.startDate, endDate.toISOString().split('T')[0]);
          return {
              id: `proj_main_${p.id}`,
              resourceId: `proj_${p.id}`,
              title: `${p.name} (${formatDate(p.startDate)}～${formatDate(p.endDate)} ${duration}日間)`,
              start: p.startDate,
              end: endDate.toISOString().split('T')[0],
              className: 'project-main-event',
          };
      });
      
      const taskEvents: CalendarEvent[] = tasksData.map(t => {
          const endDate = new Date(t.endDate);
          endDate.setDate(endDate.getDate() + 1);
          return {
              id: `task_bar_${t.id}`,
              resourceId: `task_${t.id}`,
              title: serviceMap.get(t.serviceMasterId) || '',
              start: t.startDate,
              end: endDate.toISOString().split('T')[0],
              className: 'task-event',
          };
      });

      const assignmentEvents: CalendarEvent[] = assignmentsData.map(a => {
          let projectName = '未設定';
          if (a.projectId) {
              projectName = projectMap.get(a.projectId) || '不明な案件';
          } else {
              const projectTask = tasksData.find(t => t.id === a.projectTaskId);
              if (projectTask) {
                projectName = projectMap.get(projectTask.projectId) || '不明な案件';
              }
          }
          return {
              id: `assign_${a.id}`,
              resourceId: `work_${a.workerId}`,
              title: projectName,
              start: a.date,
              className: 'assignment-event',
          }
      });

      setEvents([...projectMainEvents, ...taskEvents, ...assignmentEvents]);

    } catch (err: any) {
      console.error("エラー:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, []);
  
  // eventDrop用
  const handleEventDrop = async (arg: EventDropArg) => {
    const { event } = arg;
    const eventId = event.id;

    if (eventId.startsWith('proj_main_') && 'newResource' in arg && arg.newResource?.id.startsWith('work_')) {
        const projectId = Number(eventId.replace('proj_main_', ''));
        const workerId = Number(arg.newResource.id.replace('work_', ''));
        const date = event.startStr;

        const { data: firstTask } = await supabase
            .from('ProjectTasks')
            .select('id')
            .eq('projectId', projectId)
            .order('order', { ascending: true })
            .limit(1)
            .single();

        const { error: insertError } = await supabase
            .from('Assignments')
            .insert({ 
                projectId: projectId, 
                workerId: workerId, 
                date: date,
                projectTaskId: firstTask ? firstTask.id : null
            });

        if (insertError) {
            alert("新しい人員配置の作成に失敗しました。");
        } else {
            fetchData();
        }
        arg.revert();
        return;
    }

    if (eventId.startsWith('assign_')) {
        const assignmentId = Number(eventId.replace('assign_', ''));
        
        const currentResources = event.getResources();
        if (!currentResources || currentResources.length === 0) {
            alert("移動先の作業員を特定できませんでした。");
            arg.revert();
            return;
        }
        
        const targetResource = currentResources[0];
        const newWorkerId = Number(targetResource.id.replace('work_', ''));
        const newDate = event.startStr;

        setEvents(prev => prev.map(e => e.id === event.id ? { ...e, resourceId: targetResource.id, start: newDate } : e));
        const { error } = await supabase
            .from('Assignments')
            .update({ workerId: newWorkerId, date: newDate })
            .eq('id', assignmentId);
        if (error) {
            alert("人員配置の更新に失敗しました。");
            arg.revert();
        }
        return;
    }

    if (eventId.startsWith('proj_main_') || eventId.startsWith('task_bar_')) {
        if ('newResource' in arg && arg.newResource && arg.oldResource && arg.newResource.id !== arg.oldResource.id) {
            alert("工程バーは他の行に移動できません。");
            arg.revert();
            return;
        }

        const isProject = eventId.startsWith('proj_main_');
        const table = isProject ? 'Projects' : 'ProjectTasks';
        const id = Number(eventId.replace(isProject ? 'proj_main_' : 'task_bar_', ''));
        
        setEvents(prev => prev.map(e => {
            if (e.id === event.id) {
                const updatedEvent = { ...e, start: event.startStr, end: event.endStr };
                if (isProject) {
                    const duration = getDuration(updatedEvent.start, updatedEvent.end || updatedEvent.start);
                    const name = resources.find(r => r.id === updatedEvent.resourceId)?.title || '';
                    const endDate = event.end ? new Date(event.end.getTime() - 1) : new Date(event.startStr);
                    updatedEvent.title = `${name} (${formatDate(updatedEvent.start)}～${formatDate(endDate.toISOString().split('T')[0])} ${duration}日間)`;
                }
                return updatedEvent;
            }
            return e;
        }));

        const { error } = await supabase
            .from(table)
            .update({ 
                startDate: event.startStr,
                endDate: event.end ? new Date(event.end.getTime() - 1).toISOString().split('T')[0] : event.startStr
            })
            .eq('id', id);

        if (error) {
            alert("工期の更新に失敗しました。");
            arg.revert();
        }
        return;
    }
    
    arg.revert();
  };
  
  const dailyAssignmentCount = new Map<string, number>();
  events.filter(e => e.className === 'assignment-event').forEach(e => {
      const key = `${e.resourceId}_${e.start}`;
      dailyAssignmentCount.set(key, (dailyAssignmentCount.get(key) || 0) + 1);
  });

  // eventResize用
  const handleEventResize = async (arg: any) => {
    // 必要に応じてresize時の処理を記述。現状はdropと同じくrevertのみ。
    arg.revert();
  };

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

  useEffect(() => {
    if (!loading) {
        const calendarApi = calendarRef.current?.getApi();
        if(calendarApi) {
            calendarApi.gotoDate(new Date());
        }
    }
  }, [loading]);

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
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          editable={true}
          resources={resources}
          resourceGroupField="group"
          resourceOrder="group,order"
          events={events}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventContent={renderEventContent}
          dayCellClassNames={ (arg) => getDayClasses(arg.date) }
          slotMinWidth={60}
          resourceAreaWidth="250px"
        />
      </Paper>
      <style>{`
        /* 行の高さ調整 */
        .fc-resource-timeline .fc-timeline-lane[data-resource-id^="proj_"] .fc-timeline-lane-frame { height: 30px !important; }
        .fc-resource-timeline .fc-timeline-lane[data-resource-id^="task_"] .fc-timeline-lane-frame { height: 30px !important; }
        .fc-resource-timeline .fc-timeline-lane[data-resource-id^="work_"] .fc-timeline-lane-frame { height: 60px !important; }
        /* 案件名の行の、最低の高さを35pxにする */
        .fc-datagrid-cell[data-resource-id^="proj_"] .fc-datagrid-cell-frame { height: 30px !important; }
        /* 作業項目の行の高さを、30pxに固定する */
        .fc-datagrid-cell[data-resource-id^="task_"] .fc-datagrid-cell-frame { height: 30px !important; }
        /* 作業員項目の行の高さを、30pxに固定する */
        .fc-datagrid-cell[data-resource-id^="work_"] .fc-datagrid-cell-frame { height: 60px !important; }

        /* バー共通のスタイル */
        .fc-timeline-event.fc-event-main { 
            border-radius: 4px !important; /* ガワの角を丸くする */
            overflow: hidden !important;   /* はみ出しを隠す */
        }
        .fc-timeline-event.fc-event-main .fc-event-main-frame {
            border-radius: 4px !important; /* ★★中身の角も、ちゃんと丸くする！★★ */
            overflow: hidden !important;
        }
        .event-title { 
            font-size: 12px; 
            color: white; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            line-height: 2.0; 
        }

        
        /* バー個別の色 */
        .fc-event.project-main-event { background-color: #a9cce3; border-color: #5499c7; cursor: grab; }
        .fc-event.project-main-event .event-title { color: #1a5276; font-weight: bold; }
        .fc-event.task-event { background-color: #3498db; border-color: #2980b9; }
        .fc-event.assignment-event { background-color: #2ecc71; border-color: #27ae60; }
        
        /* 人員配置イベントのスタイル */
        .assignment-event-title {
            padding: 2px 4px;
            font-size: 10px;
            line-height: 0.8;
            height: 100%;
            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            text-overflow: ellipsis;
            word-break: break-all;
        }
        
        /* 曜日の色分けをより強く指定 */
        .fc-timeline-slot.saturday .fc-timeline-slot-lane, .fc-datagrid-cell.saturday { 
            background-color: #eaf4ff !important; 
        }
        .fc-timeline-slot.sunday .fc-timeline-slot-lane, .fc-datagrid-cell.sunday,
        .fc-timeline-slot.holiday .fc-timeline-slot-lane, .fc-datagrid-cell.holiday { 
            background-color: #ffe9e9 !important; 
        }
      `}</style>
    </div>
  );
}
