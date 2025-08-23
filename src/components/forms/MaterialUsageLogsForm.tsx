import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { TextField, Button, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

interface MaterialUsageLog {
  id: number;
  dailyReportId: number;
  materialId: number;
  quantityUsed: number;
}

export default function MaterialUsageLogsForm() {
  const [dailyReportId, setDailyReportId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [quantityUsed, setQuantityUsed] = useState('');
  const [message, setMessage] = useState('');
  const [materialUsageLogs, setMaterialUsageLogs] = useState<MaterialUsageLog[]>([]);

  const fetchMaterialUsageLogs = async () => {
    const { data, error } = await supabase
      .from('MaterialUsageLogs')
      .select('*');
    if (error) {
      console.error('Error fetching material usage logs:', error);
    } else {
      setMaterialUsageLogs(data as MaterialUsageLog[]);
    }
  };

  useEffect(() => {
    fetchMaterialUsageLogs();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!dailyReportId || !materialId || !quantityUsed) {
      setMessage('すべてのフィールドを入力してください。');
      return;
    }

    const { data, error } = await supabase.from('MaterialUsageLogs').insert([
      {
        dailyReportId: parseInt(dailyReportId, 10),
        materialId: parseInt(materialId, 10),
        quantityUsed: parseFloat(quantityUsed),
      },
    ]);

    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage('データが正常に挿入されました。');
      // フォームをリセット
      setDailyReportId('');
      setMaterialId('');
      setQuantityUsed('');
      fetchMaterialUsageLogs(); // Refresh the list
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('この資材使用ログを削除しますか？')) {
      const { error } = await supabase
        .from('MaterialUsageLogs')
        .delete()
        .eq('id', id);
      if (error) {
        setMessage(`エラーが発生しました: ${error.message}`);
      } else {
        setMessage('データが正常に削除されました。');
        fetchMaterialUsageLogs(); // Refresh the list
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        資材使用ログ (MaterialUsageLogs)
      </Typography>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          <TextField label="日報ID" type="number" value={dailyReportId} onChange={(e) => setDailyReportId(e.target.value)} required />
          <TextField label="資材ID" type="number" value={materialId} onChange={(e) => setMaterialId(e.target.value)} required />
          <TextField label="使用量" type="number" value={quantityUsed} onChange={(e) => setQuantityUsed(e.target.value)} required />
          <Button type="submit" variant="contained">
            データ挿入
          </Button>
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
              <TableCell>ID</TableCell>
              <TableCell>日報ID</TableCell>
              <TableCell>資材ID</TableCell>
              <TableCell>使用量</TableCell>
              <TableCell>削除</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {materialUsageLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{log.id}</TableCell>
                <TableCell>{log.dailyReportId}</TableCell>
                <TableCell>{log.materialId}</TableCell>
                <TableCell>{log.quantityUsed}</TableCell>
                <TableCell>
                  <Button variant="contained" color="secondary" onClick={() => handleDelete(log.id)}>
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