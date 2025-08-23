import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { TextField, Button, Box, Typography } from '@mui/material';

export default function WorkLogsForm() {
  const [dailyReportId, setDailyReportId] = useState('');
  const [projectTaskId, setProjectTaskId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!dailyReportId || !projectTaskId) {
      setMessage('日報IDとプロジェクトタスクIDを入力してください。');
      return;
    }

    const { data, error } = await supabase.from('WorkLogs').insert([
      {
        dailyReportId: parseInt(dailyReportId, 10),
        projectTaskId: parseInt(projectTaskId, 10),
        startTime,
        endTime,
      },
    ]);

    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage('データが正常に挿入されました。');
      // フォームをリセット
      setDailyReportId('');
      setProjectTaskId('');
      setStartTime('');
      setEndTime('');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        作業ログ (WorkLogs)
      </Typography>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          <TextField label="日報ID" type="number" value={dailyReportId} onChange={(e) => setDailyReportId(e.target.value)} required />
          <TextField label="プロジェクトタスクID" type="number" value={projectTaskId} onChange={(e) => setProjectTaskId(e.target.value)} required />
          <TextField label="開始時間" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="終了時間" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button type="submit" variant="contained">
            データ挿入
          </Button>
        </Box>
      </form>
      {message && <Typography sx={{ mt: 2 }}>{message}</Typography>}
    </Box>
  );
}