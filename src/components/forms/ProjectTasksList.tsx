import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography } from '@mui/material';

import { IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

interface ProjectTask {
  id: number;
  projectId: number;
  status: string;
  startDate: string;
  endDate: string;
  order: number; // Add order field
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

  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  const handleToggleExpand = (projectId: number) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

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

  const groupedTasks = tasks.reduce((acc, task) => {
    if (!acc[task.projectId]) {
      acc[task.projectId] = [];
    }
    acc[task.projectId].push(task);
    return acc;
  }, {} as Record<number, ProjectTask[]>);

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
          {Object.entries(groupedTasks).sort(([projIdA], [projIdB]) => {
            const projA = projects.find(p => p.id === Number(projIdA));
            const projB = projects.find(p => p.id === Number(projIdB));
            return (projA?.name || '').localeCompare(projB?.name || '');
          }).map(([projectId, projectTasks]) => {
            const sortedTasks = [...projectTasks].sort((a, b) => a.order - b.order);
            const isExpanded = expandedProjects.has(Number(projectId));
            const initialTask = sortedTasks[0];

            return (
              <>
                <TableRow key={`project-${projectId}`}>
                  <TableCell>
                    <IconButton onClick={() => handleToggleExpand(Number(projectId))} size="small">
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                    {getProjectName(Number(projectId))}
                  </TableCell>
                  <TableCell>{initialTask?.status || ''}</TableCell>
                  <TableCell>{initialTask?.startDate || ''}</TableCell>
                  <TableCell>{initialTask?.endDate || ''}</TableCell>
                </TableRow>
                {isExpanded && sortedTasks.slice(1).map(task => (
                  <TableRow key={task.id}>
                    <TableCell></TableCell> {/* Empty cell for alignment */}
                    <TableCell>{task.status}</TableCell>
                    <TableCell>{task.startDate}</TableCell>
                    <TableCell>{task.endDate}</TableCell>
                  </TableRow>
                ))}
              </>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
