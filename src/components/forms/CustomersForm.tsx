import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { TextField, Button, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

interface Customer {
  id: number;
  name: string;
  address: string;
  contactPerson: string;
  phone: string;
}

export default function CustomersForm() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('Customers')
      .select('*');
    if (error) {
      console.error('Error fetching customers:', error);
    } else {
      setCustomers(data as Customer[]);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const resetForm = () => {
    setName('');
    setAddress('');
    setContactPerson('');
    setPhone('');
    setEditingCustomer(null);
    setIsEditing(false);
  };

  const handleEdit = (customer: Customer) => {
    setName(customer.name);
    setAddress(customer.address);
    setContactPerson(customer.contactPerson);
    setPhone(customer.phone);
    setEditingCustomer(customer);
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!name) {
      setMessage('名前を入力してください。');
      return;
    }

    const customerData = {
      name,
      address,
      contactPerson,
      phone,
    };

    let error = null;
    if (isEditing && editingCustomer) {
      const { error: updateError } = await supabase.from('Customers').update(customerData).eq('id', editingCustomer.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('Customers').insert([customerData]);
      error = insertError;
    }

    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage(isEditing ? 'データが正常に更新されました。' : 'データが正常に挿入されました。');
      resetForm();
      fetchCustomers(); // Refresh the list
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('この顧客を削除しますか？')) {
      const { error } = await supabase
        .from('Customers')
        .delete()
        .eq('id', id);
      if (error) {
        setMessage(`エラーが発生しました: ${error.message}`);
      } else {
        setMessage('データが正常に削除されました。');
        fetchCustomers(); // Refresh the list
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        顧客 (Customers)
      </Typography>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          <TextField label="名前" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="住所" value={address} onChange={(e) => setAddress(e.target.value)} />
          <TextField label="担当者" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          <TextField label="電話番号" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button type="submit" variant="contained">
              {isEditing ? 'データ更新' : 'データ挿入'}
            </Button>
            {isEditing && (
              <Button type="button" variant="outlined" onClick={resetForm}>
                キャンセル
              </Button>
            )}
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
              <TableCell>名前</TableCell>
              <TableCell>住所</TableCell>
              <TableCell>担当者</TableCell>
              <TableCell>電話番号</TableCell>
              <TableCell>編集</TableCell>
              <TableCell>削除</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>{customer.name}</TableCell>
                <TableCell>{customer.address}</TableCell>
                <TableCell>{customer.contactPerson}</TableCell>
                <TableCell>{customer.phone}</TableCell>
                <TableCell>
                  <Button variant="contained" color="primary" onClick={() => handleEdit(customer)}>
                    編集
                  </Button>
                </TableCell>
                <TableCell>
                  <Button variant="contained" color="secondary" onClick={() => handleDelete(customer.id)}>
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