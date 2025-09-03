import { useEffect, useState, useCallback } from 'react';
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
interface Customer {
  name: string | null;
}

interface Project {
  id: number;
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  Customers: Customer | null;
}


export default function ProjectsPage() {
  // 右クリック禁止の共通ハンドラ
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleRowClick = (projectId: number) => {
    navigate(`/projects/${projectId}`);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('Projects')
        .select('*, Customers ( name )')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching projects:', error);
      } else if (data) {
        setProjects(data as Project[]);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <Typography>読み込み中...</Typography>;
  }

  return (
    <div id="projects-root">
      <Typography variant="h4" gutterBottom>
        案件一覧
      </Typography>
      <TableContainer component={Paper} onContextMenu={handleContextMenu}>
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
                onClick={() => handleRowClick(project.id)}
                sx={{ '&:hover': { cursor: 'pointer', backgroundColor: '#f5f5f5' } }}
                onContextMenu={handleContextMenu}
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
                  onContextMenu={handleContextMenu}
                >
                  {project.name}
                </TableCell>
                <TableCell onContextMenu={handleContextMenu}>
                  {project.Customers?.name}
                </TableCell>
                <TableCell onContextMenu={handleContextMenu}>
                  {project.startDate} ~ {project.endDate}
                </TableCell>
                <TableCell onContextMenu={handleContextMenu}>
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