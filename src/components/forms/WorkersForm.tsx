import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { TextField, Button, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

interface Worker {
  id: number;
  name: string;
  order: number | null;
  birthDate: string | null;
  hireDate: string | null;
  address: string | null;
  contactInfo: string | null;
  cpdsNumber: string | null;
  kana: string | null;
}

export default function WorkersForm() {
  const [name, setName] = useState('');
  const [order, setOrder] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [address, setAddress] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [cpdsNumber, setCpdsNumber] = useState('');
  const [kana, setKana] = useState('');
  const [message, setMessage] = useState('');
  const [workers, setWorkers] = useState<Worker[]>([]);

  const fetchWorkers = async () => {
    const { data, error } = await supabase
      .from('Workers')
      .select('*');
    if (error) {
      console.error('Error fetching workers:', error);
    } else {
      setWorkers(data as Worker[]);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!name) {
      setMessage('名前を入力してください。');
      return;
    }

    const { data, error } = await supabase.from('Workers').insert([
      {
        name,
        order: order ? parseInt(order, 10) : null,
        birthDate,
        hireDate,
        address,
        contactInfo,
        cpdsNumber,
        kana,
      },
    ]);

    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage('データが正常に挿入されました。');
      // フォームをリセット
      setName('');
      setOrder('');
      setBirthDate('');
      setHireDate('');
      setAddress('');
      setContactInfo('');
      setCpdsNumber('');
      setKana('');
      fetchWorkers(); // Refresh the list
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('この作業員を削除しますか？')) {
      const { error } = await supabase
        .from('Workers')
        .delete()
        .eq('id', id);

      if (error) {
        setMessage(`エラーが発生しました: ${error.message}`);
      } else {
        setMessage('データが正常に削除されました。');
        fetchWorkers(); // Refresh the list
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        作業員 (Workers)
      </Typography>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          <TextField label="名前" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="フリガナ" value={kana} onChange={(e) => setKana(e.target.value)} />
          <TextField label="順番" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
          <TextField label="生年月日" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="入社日" type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="住所" value={address} onChange={(e) => setAddress(e.target.value)} />
          <TextField label="連絡先" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
          <TextField label="CPDS番号" value={cpdsNumber} onChange={(e) => setCpdsNumber(e.target.value)} />
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
              <TableCell>名前</TableCell>
              <TableCell>フリガナ</TableCell>
              <TableCell>生年月日</TableCell>
              <TableCell>入社日</TableCell>
              <TableCell>住所</TableCell>
              <TableCell>連絡先</TableCell>
              <TableCell>CPDS番号</TableCell>
              <TableCell>削除</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {workers.map((worker) => (
              <TableRow key={worker.id}>
                <TableCell>{worker.name}</TableCell>
                <TableCell>{worker.kana}</TableCell>
                <TableCell>{worker.birthDate}</TableCell>
                <TableCell>{worker.hireDate}</TableCell>
                <TableCell>{worker.address}</TableCell>
                <TableCell>{worker.contactInfo}</TableCell>
                <TableCell>{worker.cpdsNumber}</TableCell>
                <TableCell>
                  <Button variant="contained" color="secondary" onClick={() => handleDelete(worker.id)}>
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