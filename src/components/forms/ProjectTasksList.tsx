import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography } from '@mui/material';

interface ProjectTask {
  id: number;
  projectId: number;
  status: string;
  startDate: string;
  endDate: string;
}

interface Project {
  id: number;
  name: string;
}

export default function ProjectTasksList() {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const { data: tasksData, error: tasksError } = await supabase
        .from('ProjectTasks')
        .select('*');

      if (tasksError) {
        setError(tasksError.message);
      } else if (tasksData) {
        setTasks(tasksData as ProjectTask[]);
      }

      const { data: projectsData, error: projectsError } = await supabase
        .from('Projects')
        .select('id, name');

      if (projectsError) {
        setError(projectsError.message);
      } else if (projectsData) {
        setProjects(projectsData as Project[]);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const getProjectName = (projectId: number) => {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : '不明なプロジェクト';
  };

  if (loading) {
    return <Typography>読み込み中...</Typography>;
  }

  if (error) {
    return <Typography color="error">エラー: {error}</Typography>;
  }

  return (
    <TableContainer component={Paper} sx={{ mt: 4 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>親プロジェクト</TableCell>
            <TableCell>タスク名</TableCell>
            <TableCell>タスク開始日</TableCell>
            <TableCell>タスク終了日</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell>{getProjectName(task.projectId)}</TableCell>
              <TableCell>{task.status}</TableCell>
              <TableCell>{task.startDate}</TableCell>
              <TableCell>{task.endDate}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
