import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Paper, CircularProgress, Alert, Typography, Box, Button, ButtonGroup } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import jaLocale from '@fullcalendar/core/locales/ja';
import holidayJp from '@holiday-jp/holiday_jp';

// 型定義
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

export default function OverallSchedulePageNew() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const calendarRef = useRef<FullCalendar>(null);
  const [currentZoom, setCurrentZoom] = useState(1); // 0:週, 1:月, 2:年
  const availableViews = ['resourceTimelineWeek', 'resourceTimelineMonth', 'resourceTimelineYear'];

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          { data: projects, error: projectsError },
          { data: tasks, error: tasksError },
          { data: workers, error: workersError },
          { data: assignments, error: assignmentsError },
          { data: services, error: servicesError }
        ] = await Promise.all([
          supabase.from('Projects').select('*').order('order'),
          supabase.from('ProjectTasks').select('*').order('order'),
          supabase.from('Workers').select('*').order('order'),
          supabase.from('Assignments').select('*'),
          supabase.from('ServiceMaster').select('id, name')
        ]);
        if (projectsError || tasksError || workersError || assignmentsError || servicesError) {
          throw new Error('データ取得に失敗しました');
        }
        // サービス名マップ
        const serviceMap = new Map(services.map((s: any) => [s.id, s.name]));
        // リソース作成
        const projectResources: Resource[] = projects.map((p: any) => ({
          id: `proj_${p.id}`,
          title: p.name || '名称未設定',
          group: 'projects',
          order: p.order,
        }));
        const taskResources: Resource[] = tasks.map((t: any) => ({
          id: `task_${t.id}`,
          parentId: `proj_${t.projectId}`,
          title: serviceMap.get(t.serviceMasterId) || '名称未設定',
          group: 'projects',
          order: t.order,
        }));
        const workerResources: Resource[] = workers.map((w: any) => ({
          id: `work_${w.id}`,
          title: w.name || '名称未設定',
          group: 'workers',
          order: w.order,
        }));
        setResources([...projectResources, ...taskResources, ...workerResources]);
        // イベント作成
        const projectBgEvents: CalendarEvent[] = projects.map((p: any) => ({
          id: `proj_bg_${p.id}`,
          resourceId: `proj_${p.id}`,
          title: `[${p.name}] (${formatDate(p.startDate)}～${formatDate(p.endDate)} ${getDays(p.startDate, p.endDate)}日間)` ,
          start: p.startDate,
          end: p.endDate,
          display: 'background',
          className: 'project-bg-event',
        }));
        const taskEvents: CalendarEvent[] = tasks.map((t: any) => ({
          id: `task_bar_${t.id}`,
          resourceId: `task_${t.id}`,
          title: serviceMap.get(t.serviceMasterId) || '',
          start: t.startDate,
          end: t.endDate,
          className: 'task-event',
        }));
        const assignmentEvents: CalendarEvent[] = assignments.map((a: any) => {
          const task = tasks.find((t: any) => t.id === a.projectTaskId);
          const project = task ? projects.find((p: any) => p.id === task.projectId) : undefined;
          return {
            id: `assign_${a.id}`,
            resourceId: `work_${a.workerId}`,
            title: project?.name || '未設定',
            start: a.date,
            className: 'assignment-event',
          };
        });
        setEvents([...projectBgEvents, ...taskEvents, ...assignmentEvents]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 工程バー・人員配置のD&D処理
  const handleEventDrop = async (arg: any) => {
    const { event, oldResource, newResource } = arg;
    const eventId = event.id;
    if (eventId.startsWith('assign_')) {
      // 人員配置の移動
      const assignmentId = Number(eventId.replace('assign_', ''));
      const newWorkerId = Number((newResource || oldResource)?.id.replace('work_', ''));
      const newDate = event.startStr;
      const { error } = await supabase.from('Assignments').update({ workerId: newWorkerId, date: newDate }).eq('id', assignmentId);
      if (error) {
        arg.revert();
        return;
      }
    } else if (eventId.startsWith('task_bar_')) {
      // タスクバーの移動・期間変更
      if (newResource && oldResource && newResource.id !== oldResource.id) {
        arg.revert();
        return;
      }
      const taskId = Number(eventId.replace('task_bar_', ''));
      const { error } = await supabase.from('ProjectTasks').update({ startDate: event.startStr, endDate: event.end ? event.endStr : event.startStr }).eq('id', taskId);
      if (error) {
        arg.revert();
        return;
      }
    } else if (eventId.startsWith('proj_bg_')) {
      // プロジェクトバーの移動・リサイズ
      const projectId = Number(eventId.replace('proj_bg_', ''));
      // 変更前・後の日付差分（日数）を計算
      const oldStart = new Date(event._def.extendedProps.startDate || event.startStr);
      const newStart = new Date(event.startStr);
      const diffDays = Math.round((newStart.getTime() - oldStart.getTime()) / (1000 * 60 * 60 * 24));
      // プロジェクト本体を更新
      const { error: projError } = await supabase.from('Projects').update({ startDate: event.startStr, endDate: event.end ? event.endStr : event.startStr }).eq('id', projectId);
      if (projError) {
        arg.revert();
        return;
      }
      // 配下タスクも同じ日数分だけ移動
      const { data: tasks } = await supabase.from('ProjectTasks').select('*').eq('projectId', projectId);
      if (tasks && diffDays !== 0) {
        for (const t of tasks) {
          const tStart = new Date(t.startDate);
          const tEnd = t.endDate ? new Date(t.endDate) : tStart;
          const newTStart = new Date(tStart.getTime() + diffDays * 24 * 60 * 60 * 1000);
          const newTEnd = new Date(tEnd.getTime() + diffDays * 24 * 60 * 60 * 1000);
          await supabase.from('ProjectTasks').update({
            startDate: newTStart.toISOString().slice(0, 10),
            endDate: newTEnd.toISOString().slice(0, 10)
          }).eq('id', t.id);
        }
      }
    } else {
      arg.revert();
      return;
    }
    // DB更新後に即時再取得
    // fetchData() 相当の再取得
    setLoading(true);
    setError(null);
    try {
      const [
        { data: projects },
        { data: tasks },
        { data: workers },
        { data: assignments },
        { data: services }
      ] = await Promise.all([
        supabase.from('Projects').select('*').order('order'),
        supabase.from('ProjectTasks').select('*').order('order'),
        supabase.from('Workers').select('*').order('order'),
        supabase.from('Assignments').select('*'),
        supabase.from('ServiceMaster').select('id, name')
      ]);
      const serviceMap = new Map((services ?? []).map((s: any) => [s.id, s.name]));
      const projectResources: Resource[] = (projects ?? []).map((p: any) => ({
        id: `proj_${p.id}`,
        title: p.name || '名称未設定',
        group: 'projects',
        order: p.order,
      }));
      const taskResources: Resource[] = (tasks ?? []).map((t: any) => ({
        id: `task_${t.id}`,
        parentId: `proj_${t.projectId}`,
        title: serviceMap.get(t.serviceMasterId) || '名称未設定',
        group: 'projects',
        order: t.order,
      }));
      const workerResources: Resource[] = (workers ?? []).map((w: any) => ({
        id: `work_${w.id}`,
        title: w.name || '名称未設定',
        group: 'workers',
        order: w.order,
      }));
      setResources([...projectResources, ...taskResources, ...workerResources]);
      const projectBgEvents: CalendarEvent[] = (projects ?? []).map((p: any) => ({
        id: `proj_bg_${p.id}`,
        resourceId: `proj_${p.id}`,
        title: `[${p.name}] (${formatDate(p.startDate)}～${formatDate(p.endDate)} ${getDays(p.startDate, p.endDate)}日間)` ,
        start: p.startDate,
        end: p.endDate,
        display: 'background',
        className: 'project-bg-event',
      }));
      const taskEvents: CalendarEvent[] = (tasks ?? []).map((t: any) => ({
        id: `task_bar_${t.id}`,
        resourceId: `task_${t.id}`,
        title: serviceMap.get(t.serviceMasterId) || '',
        start: t.startDate,
        end: t.endDate,
        className: 'task-event',
      }));
      const assignmentEvents: CalendarEvent[] = (assignments ?? []).map((a: any) => {
        const task = (tasks ?? []).find((t: any) => t.id === a.projectTaskId);
        const project = task ? (projects ?? []).find((p: any) => p.id === task.projectId) : undefined;
        return {
          id: `assign_${a.id}`,
          resourceId: `work_${a.workerId}`,
          title: project?.name || '未設定',
          start: a.date,
          className: 'assignment-event',
        };
      });
      setEvents([...projectBgEvents, ...taskEvents, ...assignmentEvents]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 日付フォーマット
  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  function getDays(start: string, end: string) {
    if (!start || !end) return '';
    const s = new Date(start);
    const e = new Date(end);
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  // 土日祝の色分け
  function dayCellClassNames(arg: any) {
    const day = arg.date.getDay();
    if (holidayJp.isHoliday(arg.date)) return ['holiday'];
    if (day === 0) return ['sunday'];
    if (day === 6) return ['saturday'];
    return [];
  }

  // 拡大・縮小
  const handleZoomIn = () => setCurrentZoom(z => Math.max(0, z - 1));
  const handleZoomOut = () => setCurrentZoom(z => Math.min(availableViews.length - 1, z + 1));
  useEffect(() => {
    calendarRef.current?.getApi().changeView(availableViews[currentZoom]);
  }, [currentZoom]);

  // 今日を初期表示位置に
  useEffect(() => {
    if (!loading && calendarRef.current) {
      const now = new Date();
      calendarRef.current.getApi().scrollToTime({ hours: now.getHours(), minutes: now.getMinutes() });
    }
  }, [loading]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>全体工程管理ボード（新）</Typography>
        <ButtonGroup variant="outlined">
          <Button onClick={handleZoomOut}>- 縮小</Button>
          <Button onClick={handleZoomIn}>+ 拡大</Button>
        </ButtonGroup>
      </Box>
      <Paper sx={{ mt: 2 }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
          locale={jaLocale}
          initialView={availableViews[currentZoom]}
          initialDate={new Date()}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          editable={true}
          resources={resources}
          resourceGroupField="group"
          resourceOrder="group,order"
          events={events}
          eventDrop={handleEventDrop}
          eventResize={handleEventDrop}
          dayCellClassNames={dayCellClassNames}
          slotMinWidth={60}
          resourceAreaWidth="250px"
        />
      </Paper>
      <style>{`
        .fc-resource-timeline .fc-timeline-lane[data-resource-id^="proj_"] .fc-timeline-lane-frame { min-height: 35px !important; }
        .fc-resource-timeline .fc-timeline-lane[data-resource-id^="task_"] .fc-timeline-lane-frame { height: 28px !important; }
        .fc-resource-timeline .fc-timeline-lane[data-resource-id^="work_"] .fc-timeline-lane-frame { height: 90px !important; }
        .fc-datagrid-cell[data-resource-id^="work_"] .fc-datagrid-cell-frame { height: 90px !important; }
        .fc-timeline-event.fc-event-main { border-radius: 4px; padding: 2px 4px; height: 100%; box-sizing: border-box; }
        .event-title { font-size: 12px; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.8; }
        .fc-event.project-bg-event { background-color: #f5f5f5; border: none; color: #333; }
        .fc-event.task-event { background-color: #3498db; border-color: #2980b9; }
        .fc-event.assignment-event { background-color: #2ecc71; border-color: #27ae60; }
        .fc-timeline-slot.saturday .fc-timeline-slot-lane, .fc-datagrid-cell.saturday { background-color: #eaf4ff !important; }
        .fc-timeline-slot.sunday .fc-timeline-slot-lane, .fc-datagrid-cell.sunday { background-color: #ffe9e9 !important; }
        .fc-timeline-slot.holiday .fc-timeline-slot-lane, .fc-datagrid-cell.holiday { background-color: #ffe9e9 !important; }
      `}</style>
    </div>
  );
}
