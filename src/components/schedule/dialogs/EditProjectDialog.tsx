import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography } from '@mui/material';
import { SketchPicker, type ColorResult } from 'react-color';

interface EditProjectDialogProps {
    open: boolean;
    onClose: () => void;
    formData: { name: string; bar_color: string; };
    onFormChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onColorChange: (color: ColorResult) => void;
    onSave: () => void;
}

export const EditProjectDialog = ({ open, onClose, formData, onFormChange, onColorChange, onSave }: EditProjectDialogProps) => {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>プロジェクトの編集</DialogTitle>
            <DialogContent>
                <TextField autoFocus margin="dense" id="name" name="name" label="案件名" type="text" fullWidth variant="standard" value={formData.name} onChange={onFormChange} />
                <Box sx={{ mt: 2 }}>
                    <Typography variant="body1">バーの色</Typography>
                    <SketchPicker color={formData.bar_color} onChange={onColorChange} />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>キャンセル</Button>
                <Button onClick={onSave}>保存</Button>
            </DialogActions>
        </Dialog>
    );
};