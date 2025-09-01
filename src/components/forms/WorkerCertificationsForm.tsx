import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { TextField, Button, Box, Typography } from '@mui/material';

export default function WorkerCertificationsForm() {
  const [workerId, setWorkerId] = useState('');
  const [name, setName] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!workerId || !name) {
      setMessage('作業員IDと資格名を入力してください。');
      return;
    }

    const { error } = await supabase.from('WorkerCertifications').insert([
      {
        workerId: parseInt(workerId, 10),
        name,
        acquisitionDate,
        expiryDate,
      },
    ]);

    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage('データが正常に挿入されました。');
      // フォームをリセット
      setWorkerId('');
      setName('');
      setAcquisitionDate('');
      setExpiryDate('');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        作業員の資格 (WorkerCertifications)
      </Typography>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          <TextField label="作業員ID" type="number" value={workerId} onChange={(e) => setWorkerId(e.target.value)} required />
          <TextField label="資格名" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="取得日" type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="有効期限" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button type="submit" variant="contained">
            データ挿入
          </Button>
        </Box>
      </form>
      {message && <Typography sx={{ mt: 2 }}>{message}</Typography>}
    </Box>
  );
}