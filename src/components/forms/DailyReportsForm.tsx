import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { TextField, Button, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Select, MenuItem, InputLabel, FormControl } from '@mui/material';

interface DailyReport {
  id: number;
  workerId: number;
  date: string;
  weather: string;
  generalComments: string;
  materialsTakenOut: string;
}

interface Worker {
  id: number;
  name: string;
}

export default function DailyReportsForm() {
  const [workerId, setWorkerId] = useState('');
  const [date, setDate] = useState('');
  const [weather, setWeather] = useState('');
  const [generalComments, setGeneralComments] = useState('');
  const [materialsTakenOut, setMaterialsTakenOut] = useState('');
  const [message, setMessage] = useState('');
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);

  const fetchDailyReports = async () => {
    const { data, error } = await supabase
      .from('DailyReports')
      .select('*');
    if (error) {
      console.error('Error fetching daily reports:', error);
    } else {
      setDailyReports(data as DailyReport[]);
    }
  };

  useEffect(() => {
    const fetchWorkers = async () => {
      const { data, error } = await supabase.from('Workers').select('id, name');
      if (error) {
        console.error('Error fetching workers:', error);
      } else {
        setWorkers(data);
      }
    };
    fetchWorkers();
    fetchDailyReports();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!workerId || !date) {
      setMessage('作業員と日付を入力してください。');
      return;
    }

    const { data, error } = await supabase.from('DailyReports').insert([
      {
        workerId: parseInt(workerId, 10),
        date,
        weather,
        generalComments,
        materialsTakenOut,
      },
    ]);

    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage('データが正常に挿入されました。');
      // フォームをリセット
      setWorkerId('');
      setDate('');
      setWeather('');
      setGeneralComments('');
      setMaterialsTakenOut('');
      fetchDailyReports(); // Refresh the list
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('この日報を削除しますか？')) {
      const { error } = await supabase
        .from('DailyReports')
        .delete()
        .eq('id', id);
      if (error) {
        setMessage(`エラーが発生しました: ${error.message}`);
      } else {
        setMessage('データが正常に削除されました。');
        fetchDailyReports(); // Refresh the list
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        作業日報 (DailyReports)
      </Typography>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          <FormControl fullWidth required>
            <InputLabel id="worker-select-label">作業員</InputLabel>
            <Select
              labelId="worker-select-label"
              id="worker-select"
              value={workerId}
              label="作業員"
              onChange={(e) => setWorkerId(e.target.value)}
            >
              {workers.map((worker) => (
                <MenuItem key={worker.id} value={worker.id}>
                  {worker.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="日付" type="date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
          <TextField label="天気" value={weather} onChange={(e) => setWeather(e.target.value)} />
          <TextField label="コメント" value={generalComments} onChange={(e) => setGeneralComments(e.target.value)} multiline rows={4} />
          <TextField label="持ち出し資材" value={materialsTakenOut} onChange={(e) => setMaterialsTakenOut(e.target.value)} multiline rows={4} />
          <Button type="submit" variant="contained">
            データ挿入
          </Button>
        </Box>
      </form>
      {message && <Typography sx={{ mt: 2 }}>{message}</Typography>}\n
      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        登録済みデータ
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>作業員</TableCell>
              <TableCell>日付</TableCell>
              <TableCell>天気</TableCell>
              <TableCell>コメント</TableCell>
              <TableCell>持ち出し資材</TableCell>
              <TableCell>削除</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dailyReports.map((report) => (
              <TableRow key={report.id}>
                <TableCell>{workers.find(w => w.id === report.workerId)?.name || report.workerId}</TableCell>
                <TableCell>{report.date}</TableCell>
                <TableCell>{report.weather}</TableCell>
                <TableCell>{report.generalComments}</TableCell>
                <TableCell>{report.materialsTakenOut}</TableCell>
                <TableCell>
                  <Button variant="contained" color="secondary" onClick={() => handleDelete(report.id)}>
                    削除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}