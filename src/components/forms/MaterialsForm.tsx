import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { TextField, Button, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

interface Material {
  id: number;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  colorInfo: string;
  packagingOptions: any; // Consider a more specific type if structure is known
}

export default function MaterialsForm() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [colorInfo, setColorInfo] = useState('');
  const [packagingOptions, setPackagingOptions] = useState('');
  const [message, setMessage] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from('Materials')
      .select('*');
    if (error) {
      console.error('Error fetching materials:', error);
    } else {
      setMaterials(data as Material[]);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!name) {
      setMessage('名前を入力してください。');
      return;
    }

    const { data, error } = await supabase.from('Materials').insert([
      {
        name,
        category,
        unit,
        unitPrice: unitPrice ? parseInt(unitPrice, 10) : null,
        colorInfo,
        packagingOptions: packagingOptions ? JSON.parse(packagingOptions) : null,
      },
    ]);

    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage('データが正常に挿入されました。');
      // フォームをリセット
      setName('');
      setCategory('');
      setUnit('');
      setUnitPrice('');
      setColorInfo('');
      setPackagingOptions('');
      fetchMaterials(); // Refresh the list
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('この資材を削除しますか？')) {
      const { error } = await supabase
        .from('Materials')
        .delete()
        .eq('id', id);
      if (error) {
        setMessage(`エラーが発生しました: ${error.message}`);
      } else {
        setMessage('データが正常に削除されました。');
        fetchMaterials(); // Refresh the list
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        資材 (Materials)
      </Typography>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          <TextField label="名前" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="カテゴリ" value={category} onChange={(e) => setCategory(e.target.value)} />
          <TextField label="単位" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <TextField label="単価" type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          <TextField label="色情報" value={colorInfo} onChange={(e) => setColorInfo(e.target.value)} />
          <TextField label="荷姿 (JSON)" value={packagingOptions} onChange={(e) => setPackagingOptions(e.target.value)} multiline rows={4} />
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
              <TableCell>名前</TableCell>
              <TableCell>カテゴリ</TableCell>
              <TableCell>単位</TableCell>
              <TableCell>単価</TableCell>
              <TableCell>色情報</TableCell>
              <TableCell>荷姿</TableCell>
              <TableCell>削除</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {materials.map((material) => (
              <TableRow key={material.id}>
                <TableCell>{material.id}</TableCell>
                <TableCell>{material.name}</TableCell>
                <TableCell>{material.category}</TableCell>
                <TableCell>{material.unit}</TableCell>
                <TableCell>{material.unitPrice}</TableCell>
                <TableCell>{material.colorInfo}</TableCell>
                <TableCell>{JSON.stringify(material.packagingOptions)}</TableCell>
                <TableCell>
                  <Button variant="contained" color="secondary" onClick={() => handleDelete(material.id)}>
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