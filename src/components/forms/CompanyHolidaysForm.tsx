import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { TextField, Button, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

interface CompanyHoliday {
  id: number;
  date: string;
  description: string;
}

export default function CompanyHolidaysForm() {
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [message, setMessage] = useState('');

  const fetchHolidays = async () => {
    const { data, error } = await supabase
      .from('CompanyHolidays')
      .select('*')
      .order('date', { ascending: true });
    if (error) {
      console.error('Error fetching company holidays:', error);
    } else {
      setHolidays(data as CompanyHoliday[]);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const resetForm = () => {
    setDate('');
    setDescription('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!date) {
      setMessage('日付を入力してください。');
      return;
    }

    const holidayData = {
      date,
      description,
    };

    const { error } = await supabase.from('CompanyHolidays').insert([holidayData]);

    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage('データが正常に挿入されました。');
      resetForm();
      fetchHolidays();
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('この休業日を削除しますか？')) {
      const { error } = await supabase.from('CompanyHolidays').delete().eq('id', id);
      if (error) {
        setMessage(`エラーが発生しました: ${error.message}`);
      } else {
        setMessage('データが正常に削除されました。');
        fetchHolidays();
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        会社の休業日 (Company Holidays)
      </Typography>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          <TextField
            label="日付"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
          />
          <TextField
            label="説明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button type="submit" variant="contained">
              データ挿入
            </Button>
          </Box>
        </Box>
      </form>
      {message && <Typography sx={{ mt: 2 }}>{message}</Typography>}

      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        登録済みデータ
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>日付</TableCell>
              <TableCell>説明</TableCell>
              <TableCell>削除</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {holidays.map((holiday) => (
              <TableRow key={holiday.id}>
                <TableCell>{holiday.date}</TableCell>
                <TableCell>{holiday.description}</TableCell>
                <TableCell>
                  <Button variant="contained" color="secondary" onClick={() => handleDelete(holiday.id)}>
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
