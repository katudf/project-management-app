import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { deleteProject } from '../../utils/deleteUtils';
import { TextField, Button, Box, Typography, Checkbox, FormControlLabel, Select, MenuItem, InputLabel, FormControl, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { SketchPicker, type ColorResult } from 'react-color';

interface Customer {
  id: number;
  name: string;
}

interface Project {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  customerId: number;
  order: number;
  estimatedAmount: number | null;
  finalAmount: number | null;
  taxAmount: number | null;
  isPaid: boolean;
  estimatePdfUrl: string | null;
  contractPdfUrl: string | null;
  display_order: number;
  bar_color: string | null;
  Customers: {
    name: string;
  } | null;
}

export default function ProjectsForm() {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [finalAmount, setFinalAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [estimatePdfUrl, setEstimatePdfUrl] = useState('');
  const [contractPdfUrl, setContractPdfUrl] = useState('');
  const [barColor, setBarColor] = useState('#3788d8');
  const [displayColorPicker, setDisplayColorPicker] = useState(false);
  const [message, setMessage] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('Projects')
      .select('*, Customers ( name )');
    if (error) {
      console.error('Error fetching projects:', error);
    } else {
      setProjects(data as Project[]);
    }
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase.from('Customers').select('id, name');
      if (error) {
        console.error('Error fetching customers:', error);
      } else {
        setCustomers(data);
      }
    };
    fetchCustomers();
    fetchProjects();
  }, []);

  const resetForm = () => {
    setCustomerId('');
    setEstimatedAmount('');
    setFinalAmount('');
    setTaxAmount('');
    setIsPaid(false);
    setEstimatePdfUrl('');
    setContractPdfUrl('');
    setBarColor('#3788d8');
    setEditingProject(null);
    setIsEditing(false);
  };

  const handleEdit = (project: Project) => {
    setName(project.name);
    setStartDate(project.startDate);
    setEndDate(project.endDate);
    setStatus(project.status);
        setCustomerId(String(project.customerId));
    setEstimatedAmount(String(project.estimatedAmount || ''));
    setFinalAmount(String(project.finalAmount || ''));
    setTaxAmount(String(project.taxAmount || ''));
    setIsPaid(project.isPaid);
    setEstimatePdfUrl(project.estimatePdfUrl || '');
    setContractPdfUrl(project.contractPdfUrl || '');
    setBarColor(project.bar_color || '#3788d8');
    setEditingProject(project);
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!name || !startDate || !endDate || !status || !customerId) {
      setMessage('必須フィールドをすべて入力してください。');
      return;
    }

    const projectData = {
      name,
      startDate,
      endDate,
      status,
      customerId: parseInt(customerId, 10),
      estimatedAmount: estimatedAmount ? parseInt(estimatedAmount, 10) : null,
      finalAmount: finalAmount ? parseInt(finalAmount, 10) : null,
      taxAmount: taxAmount ? parseInt(taxAmount, 10) : null,
      isPaid,
      estimatePdfUrl,
      contractPdfUrl,
      bar_color: barColor,
    };

    let error = null;
    if (isEditing && editingProject) {
      const { error: updateError } = await supabase.from('Projects').update(projectData).eq('id', editingProject.id);
      error = updateError;
    } else {
      // Auto-assign order and display_order for new projects
      const { data: maxValues, error: maxError } = await supabase
        .from('Projects')
        .select('order, display_order')
        .order('order', { ascending: false })
        .order('display_order', { ascending: false })
        .limit(1);

      if (maxError) {
        setMessage(`最大値の取得中にエラーが発生しました: ${maxError.message}`);
        return;
      }

      const nextOrder = (maxValues && maxValues.length > 0 && maxValues[0].order !== null) ? maxValues[0].order + 1 : 1;
      const nextDisplayOrder = (maxValues && maxValues.length > 0 && maxValues[0].display_order !== null) ? maxValues[0].display_order + 1 : 1;

      const newProjectData = {
        ...projectData,
        order: nextOrder,
        display_order: nextDisplayOrder,
      };

      const { error: insertError } = await supabase.from('Projects').insert([newProjectData]);
      error = insertError;
    }

    if (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } else {
      setMessage(isEditing ? 'データが正常に更新されました。' : 'データが正常に挿入されました。');
      resetForm();
      fetchProjects(); // Refresh the list
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('このプロジェクトを削除しますか？関連するタスクと割り当てもすべて削除されます。')) {
      try {
        await deleteProject(id);
        setMessage('データが正常に削除されました。');
        fetchProjects(); // Refresh the list
      } catch (error) {
        setMessage(`エラーが発生しました: ${(error as Error).message}`);
      }
    }
  };

  const handleColorChange = (color: ColorResult) => {
    setBarColor(color.hex);
  };

  const handleColorPickerClose = () => {
    setDisplayColorPicker(false);
  };

  const handleColorPickerOpen = () => {
    setDisplayColorPicker(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        プロジェクト (Projects)
      </Typography>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          <TextField label="案件名" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField
            label="開始日"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
          />
          <TextField
            label="終了日"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
          />
          <FormControl fullWidth required>
            <InputLabel id="status-select-label">ステータス</InputLabel>
            <Select
              labelId="status-select-label"
              id="status-select"
              value={status}
              label="ステータス"
              onChange={(e) => setStatus(e.target.value)}
            >
              {[ "見積", "予定", "施工中", "完了", "中止", "保留", "受注済"].map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth required>
            <InputLabel id="customer-select-label">顧客</InputLabel>
            <Select
              labelId="customer-select-label"
              id="customer-select"
              value={customerId}
              label="顧客"
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {customers.map((customer) => (
                <MenuItem key={customer.id} value={customer.id}>
                  {customer.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <div>
            <Typography variant="body1">バーの色</Typography>
            <div style={{ padding: '5px', background: '#fff', borderRadius: '1px', boxShadow: '0 0 0 1px rgba(0,0,0,.1)', display: 'inline-block', cursor: 'pointer' }} onClick={handleColorPickerOpen}>
              <div style={{ width: '36px', height: '14px', borderRadius: '2px', background: barColor }} />
            </div>
            {displayColorPicker ? <div style={{ position: 'absolute', zIndex: '2' }}>
              <div style={{ position: 'fixed', top: '0px', right: '0px', bottom: '0px', left: '0px' }} onClick={handleColorPickerClose}/>
              <SketchPicker color={barColor} onChange={handleColorChange} />
            </div> : null}
          </div>
          <TextField
            label="見積額"
            type="number"
            value={estimatedAmount}
            onChange={(e) => setEstimatedAmount(e.target.value)}
          />
          <TextField
            label="最終金額"
            type="number"
            value={finalAmount}
            onChange={(e) => setFinalAmount(e.target.value)}
          />
          <TextField
            label="税額"
            type="number"
            value={taxAmount}
            onChange={(e) => setTaxAmount(e.target.value)}
          />
          <FormControlLabel
            control={<Checkbox checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />}
            label="支払い済み"
          />
          <TextField
            label="見積書PDFのURL"
            value={estimatePdfUrl}
            onChange={(e) => setEstimatePdfUrl(e.target.value)}
          />
          <TextField
            label="契約書PDFのURL"
            value={contractPdfUrl}
            onChange={(e) => setContractPdfUrl(e.target.value)}
          />
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
              <TableCell>案件名</TableCell>
              <TableCell>顧客名</TableCell>
              <TableCell>工事期間</TableCell>
              <TableCell>ステータス</TableCell>
              <TableCell>編集</TableCell>
              <TableCell>削除</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>{project.name}</TableCell>
                <TableCell>{project.Customers?.name}</TableCell>
                <TableCell>{project.startDate} ~ {project.endDate}</TableCell>
                <TableCell>{project.status}</TableCell>
                <TableCell>
                  <Button variant="contained" color="primary" onClick={() => handleEdit(project)}>
                    編集
                  </Button>
                </TableCell>
                <TableCell>
                  <Button variant="contained" color="secondary" onClick={() => handleDelete(project.id)}>
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