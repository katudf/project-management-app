import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from '../SortableItem';
import type { Resource } from '@/types/schedule';

interface ReorderResourcesDialogProps {
    open: boolean;
    onClose: () => void;
    resources: Resource[];
    setResources: (updater: (items: Resource[]) => Resource[]) => void;
    onSave: () => void;
}

export const ReorderResourcesDialog = ({ open, onClose, resources, setResources, onSave }: ReorderResourcesDialogProps) => {
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setResources(items => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>リソースの並び替え</DialogTitle>
            <DialogContent>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={resources.map(item => item.id)} strategy={verticalListSortingStrategy}>
                        {resources.map(item => <SortableItem key={item.id} id={item.id} title={item.title} />)}
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