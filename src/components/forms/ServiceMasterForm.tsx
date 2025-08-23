import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { TextField, Button, Box, Typography } from '@mui/material';

export default function ServiceMasterForm() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [defaultUnitPrice, setDefaultUnitPrice] = useState('');
  const [unit, setUnit] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!name) {
      setMessage('名前を入力してください。');
      return;
    }

    const { data, error } = await supabase.from('ServiceMaster').insert([
      {
        name,
        category,
        defaultUnitPrice: defaultUnitPrice ? parseInt(defaultUnitPrice, 10) : null,
        unit,
      },
    ]);

    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage('データが正常に挿入されました。');
      // フォームをリセット
      setName('');
      setCategory('');
      setDefaultUnitPrice('');
      setUnit('');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        サービスマスター (ServiceMaster)
      </Typography>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          <TextField label="名前" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="カテゴリ" value={category} onChange={(e) => setCategory(e.target.value)} />
          <TextField label="デフォルト単価" type="number" value={defaultUnitPrice} onChange={(e) => setDefaultUnitPrice(e.target.value)} />
          <TextField label="単位" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <Button type="submit" variant="contained">
            データ挿入
          </Button>
        </Box>
      </form>
      {message && <Typography sx={{ mt: 2 }}>{message}</Typography>}
    </Box>
  );
}