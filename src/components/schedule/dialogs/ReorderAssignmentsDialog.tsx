import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from '../SortableItem';
import type { CalendarEvent } from '@/types/schedule';

interface ReorderAssignmentsDialogProps {
    open: boolean;
    onClose: () => void;
    assignments: CalendarEvent[];
    setAssignments: (updater: (items: CalendarEvent[]) => CalendarEvent[]) => void;
    onSave: () => void;
}

export const ReorderAssignmentsDialog = ({ open, onClose, assignments, setAssignments, onSave }: ReorderAssignmentsDialogProps) => {
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setAssignments(items => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>表示順の変更</DialogTitle>
            <DialogContent>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={assignments.map(item => item.id)} strategy={verticalListSortingStrategy}>
                        {assignments.map(item => <SortableItem key={item.id} id={item.id} title={item.title} />)}
                    </SortableContext>
                </DndContext>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>キャンセル</Button>
                <Button onClick={onSave}>保存</Button>
            </DialogActions>
        </Dialog>
    );
};