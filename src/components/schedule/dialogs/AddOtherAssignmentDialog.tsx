import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';

interface AddOtherAssignmentDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSave: () => void;
}

export const AddOtherAssignmentDialog = ({ open, onClose, title, onTitleChange, onSave }: AddOtherAssignmentDialogProps) => {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>その他予定の追加</DialogTitle>
            <DialogContent>
                <TextField autoFocus margin="dense" id="other-title" label="予定名" type="text" fullWidth variant="standard" value={title} onChange={onTitleChange} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>キャンセル</Button>
                <Button onClick={onSave}>保存</Button>
            </DialogActions>
        </Dialog>
    );
};