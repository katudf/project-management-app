import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import type { CalendarEvent } from '@/types/schedule';

interface EditAssignmentDialogProps {
    open: boolean;
    onClose: () => void;
    event: CalendarEvent | null;
    formData: { title: string; start: string; };
    onFormChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSave: () => void;
}

export const EditAssignmentDialog = ({ open, onClose, event, formData, onFormChange, onSave }: EditAssignmentDialogProps) => {
    if (!event) return null;

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>配置情報の編集</DialogTitle>
            <DialogContent>
                <TextField autoFocus margin="dense" id="title" name="name" label="案件名" type="text" fullWidth variant="standard" value={formData.title} disabled />
                <TextField margin="dense" id="start" name="start" label="日付" type="date" fullWidth variant="standard" value={formData.start} onChange={onFormChange} InputLabelProps={{ shrink: true }} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>キャンセル</Button>
                <Button onClick={onSave}>保存</Button>
            </DialogActions>
        </Dialog>
    );
};