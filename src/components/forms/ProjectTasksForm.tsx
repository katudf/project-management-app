import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { TextField, Button, Box, Typography } from '@mui/material';
import ProjectTasksList from './ProjectTasksList';

export default function ProjectTasksForm() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [order, setOrder] = useState('');
  const [status, setStatus] = useState('');
  const [projectId, setProjectId] = useState('');
  const [serviceMasterId, setServiceMasterId] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!projectId) {
      setMessage('プロジェクトIDを入力してください。');
      return;
    }

    const { data, error } = await supabase.from('ProjectTasks').insert([
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
          <TextField label="プロジェクトID" type="number" value={projectId} onChange={(e) => setProjectId(e.target.value)} required />
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