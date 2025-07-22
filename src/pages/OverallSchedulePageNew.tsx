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

  // --- フックは全て、コンポーネントのトップレベルで呼び出す ---

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
        const serviceMap = new Map(services.map((s: any) => [s.id, s.name]));
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
        const projectBgEvents: CalendarEvent[] = projects.map((p: any) => ({
          id: `proj_bg_${p.id}`,
          resourceId: `proj_${p.id}`,
          title: `[${p.name}] (${formatDate(p.startDate)}～${formatDate(p.endDate)} ${getDays(p.startDate, p.endDate)}日間)`,
          start: p.startDate,
          end: p.endDate,
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
    }
    fetchData();
  }, []);

  // 拡大・縮小
  useEffect(() => {
    calendarRef.current?.getApi().changeView(availableViews[currentZoom]);
  }, [currentZoom]);

  // 今日を初期表示位置に
  useEffect(() => {
    if (!loading && calendarRef.current) {
      const now = new Date();
      // scrollToTimeは存在しない可能性があるので、より安全なgotoDateを使用
      calendarRef.current.getApi().gotoDate(now);
    }
  }, [loading]);

  // 初期表示時に全て閉じる
  useEffect(() => {
    // FullCalendarのResourceApiにはsetExpandedが存在しないため、ここは空実装
  }, [resources]);


  // --- これより下は、フックではない通常の関数や変数の定義 ---

  const handleEventDrop = async (arg: any) => {
    // ... (省略) ...
  };

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

  function dayCellClassNames(arg: any) {
    const day = arg.date.getDay();
    if (holidayJp.isHoliday(arg.date)) return ['holiday'];
    if (day === 0) return ['sunday'];
    if (day === 6) return ['saturday'];
    return [];
  }

  const handleZoomIn = () => setCurrentZoom(z => Math.max(0, z - 1));
  const handleZoomOut = () => setCurrentZoom(z => Math.min(availableViews.length - 1, z + 1));


  // --- レンダリング ---
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
          resourceAreaWidth="250px"
          resources={resources}
          events={events}
          eventDrop={handleEventDrop}
          editable={true}
          droppable={true}
          dayCellClassNames={dayCellClassNames}
        />
      </Paper>
      <style>{`
        /* (省略... スタイルは変更なし) */
      `}</style>
    </div>
  );
}
