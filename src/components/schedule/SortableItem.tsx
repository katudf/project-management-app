import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export const SortableItem = ({ id, title }: { id: string, title: string }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        padding: '8px 16px',
        border: '1px solid #ddd',
        marginBottom: '4px',
        backgroundColor: 'white',
        cursor: 'grab',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <span>{title}</span>
        </div>
    );
};