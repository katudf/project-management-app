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
  // キャプチャフェーズで右クリックイベントを完全遮断
  useEffect(() => {
    const stopContextMenu = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };
    // TableContainer, TableRow, TableCell すべてに適用
    const containers = document.querySelectorAll('.MuiTableContainer-root');
    const rows = document.querySelectorAll('.MuiTableRow-root');
    const cells = document.querySelectorAll('.MuiTableCell-root');
    containers.forEach(el => el.addEventListener('contextmenu', stopContextMenu, true));
    rows.forEach(el => el.addEventListener('contextmenu', stopContextMenu, true));
    cells.forEach(el => el.addEventListener('contextmenu', stopContextMenu, true));
    return () => {
      containers.forEach(el => el.removeEventListener('contextmenu', stopContextMenu, true));
      rows.forEach(el => el.removeEventListener('contextmenu', stopContextMenu, true));
      cells.forEach(el => el.removeEventListener('contextmenu', stopContextMenu, true));
    };
  }, []);
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
  <div id="projects-root">
      <Typography variant="h4" gutterBottom>
        案件一覧
      </Typography>
      <TableContainer component={Paper}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
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
                onContextMenu={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <TableCell
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 160,
                    minHeight: 32,
                    minWidth: 80,
                    backgroundColor: '#fff',
                    pointerEvents: 'auto',
                  }}
                  title={project.name || ''}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  {project.name}
                </TableCell>
                <TableCell
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  {project.Customers?.name}
                </TableCell>
                <TableCell
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  {project.startDate} ~ {project.endDate}
                </TableCell>
                <TableCell
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  {project.status}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}