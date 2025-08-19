import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography
} from '@mui/material';

// データの型を定義
interface Project {
  id: number;
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  Customers: { // 結合したCustomersテーブルのデータはこう入る
    name: string | null;
  } | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // useNavigateフックを呼び出す

  const handleRowClick = (projectId: number) => {
    navigate(`/projects/${projectId}`); // 詳細ページへ遷移
  };

  useEffect(() => {
    const getProjects = async () => {
      setLoading(true);
      // ここでテーブルを結合してデータを取得！
      const { data, error } = await supabase
        .from('Projects')
        .select('*, Customers ( name )');
      
      if (error) {
        console.error('Error fetching projects:', error);
      } else if (data) {
        setProjects(data as Project[]);
      }
      setLoading(false);
    };
    getProjects();
  }, []);

  if (loading) {
    return <Typography>読み込み中...</Typography>;
  }

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        案件一覧
      </Typography>
      <TableContainer component={Paper}>
        <Table sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell>案件名</TableCell>
              <TableCell>顧客名</TableCell>
              <TableCell>工事期間</TableCell>
              <TableCell>ステータス</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map((project) => (
              <TableRow
                key={project.id}
                onClick={() => handleRowClick(project.id)} // onClickイベントを追加
                sx={{ '&:hover': { cursor: 'pointer', backgroundColor: '#f5f5f5' } }} // ホバーエフェクトを追加
              >
                <TableCell 
                  sx={{ 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap', 
                    maxWidth: 160 // 必要に応じて幅を調整
                  }}
                  title={project.name || ''}
                >
                  {project.name}
                </TableCell>
                <TableCell>{project.Customers?.name}</TableCell> {/* オプショナルチェイニングを使用 */}
                <TableCell>{project.startDate} ~ {project.endDate}</TableCell>
                <TableCell>{project.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}