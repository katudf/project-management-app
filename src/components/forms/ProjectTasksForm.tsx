import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { TextField, Button, Box, Typography, Select, MenuItem, InputLabel, FormControl } from '@mui/material';
import ProjectTasksList from './ProjectTasksList';

interface Project {
  id: number;
  name: string;
}

export default function ProjectTasksForm() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [order, setOrder] = useState('');
  const [status, setStatus] = useState('');
  const [projectId, setProjectId] = useState('');
  const [serviceMasterId, setServiceMasterId] = useState('');
  const [message, setMessage] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data, error } = await supabase.from('Projects').select('id, name').order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching projects:', error);
      } else {
        setProjects(data);
      }
    };
    fetchProjects();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!projectId) {
      setMessage('プロジェクトIDを入力してください。');
      return;
    }

    const { error } = await supabase.from('ProjectTasks').insert([
      {
        startDate,
        endDate,
        order: order ? parseInt(order, 10) : null,
        status,
        projectId: parseInt(projectId, 10),
        serviceMasterId: serviceMasterId ? parseInt(serviceMasterId, 10) : null,
      },
    ]);

    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage('データが正常に挿入されました。');
      // フォームをリセット
      setStartDate('');
      setEndDate('');
      setOrder('');
      setStatus('');
      setProjectId('');
      setServiceMasterId('');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        プロジェクトタスク (ProjectTasks)
      </Typography>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          <FormControl fullWidth required>
            <InputLabel id="project-select-label">プロジェクト</InputLabel>
            <Select
              labelId="project-select-label"
              id="project-select"
              value={projectId}
              label="プロジェクト"
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="開始日" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="終了日" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="順番" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
          <TextField label="ステータス" value={status} onChange={(e) => setStatus(e.target.value)} />
          <TextField label="サービスマスターID" type="number" value={serviceMasterId} onChange={(e) => setServiceMasterId(e.target.value)} />
          <Button type="submit" variant="contained">
            データ挿入
          </Button>
        </Box>
      </form>
      {message && <Typography sx={{ mt: 2 }}>{message}</Typography>}
      <ProjectTasksList />
    </Box>
  );
}