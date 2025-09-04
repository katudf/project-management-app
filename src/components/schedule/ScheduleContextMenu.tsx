import { Menu, Item } from 'react-contexify';
import { formatDate } from '@/utils/dateUtils';
import type { CalendarEvent } from '@/types/schedule';
import type { ClipboardData } from '@/hooks/useEventHandlers';
import { EVENT_CLASS_NAME } from '@/constants/scheduleConstants';

export const CONTEXT_MENU_ID = 'context-menu';

interface ScheduleContextMenuProps {
    clipboard: ClipboardData;
    events: CalendarEvent[];
    selectedEventIds: string[];
    handleAssignmentCopy: (events: CalendarEvent[]) => void;
    handleAssignmentCut: (events: CalendarEvent[]) => void;
    handleAssignmentDelete: (events: CalendarEvent[]) => void;
    setReorderableAssignments: (assignments: CalendarEvent[]) => void;
    setReorderDialogOpen: (open: boolean) => void;
    setOtherAssignmentDate: (date: string) => void;
    setOtherAssignmentResourceId: (id: string) => void;
    setOtherAssignmentDialogOpen: (open: boolean) => void;
    handlePaste: (resourceId: string, date: string) => void;
    handleBlockCopy: (resourceId: string, date: string) => void;
    handleBlockCut: (resourceId: string, date: string) => void;
    handleBlockDelete: (resourceId: string, date: string) => void;
}

export const ScheduleContextMenu = (props: ScheduleContextMenuProps) => {
    const {
        clipboard,
        events,
        selectedEventIds,
        handleAssignmentCopy,
        handleAssignmentCut,
        handleAssignmentDelete,
        setReorderableAssignments,
        setReorderDialogOpen,
        setOtherAssignmentDate,
        setOtherAssignmentResourceId,
        setOtherAssignmentDialogOpen,
        handlePaste,
        handleBlockCopy,
        handleBlockCut,
        handleBlockDelete,
    } = props;

    const isAssignment = (props: any) => props?.event?.classNames.includes(EVENT_CLASS_NAME.ASSIGNMENT);
    const isDummy = (props: any) => !!props?.event?.extendedProps.isDummy;
    const isWorker = (props: any) => {
        const resource = props?.resource || props?.event?.getResources()[0];
        return resource?.group === 'workers';
    };
    const getAssignmentsOnDay = (props: any) => {
        if (!props) return [];
        const date = props.date ? formatDate(new Date(props.date).toISOString()) : props.event?.startStr;
        const resourceId = props.resource?.id || props.event?.getResources()[0]?.id;
        if (!date || !resourceId) return [];
        return events.filter(e => e.start === date && e.resourceId === resourceId && e.className === EVENT_CLASS_NAME.ASSIGNMENT);
    };

    return (
        <Menu id={CONTEXT_MENU_ID}>
            <Item
                hidden={({ props }) => isDummy(props) || !isAssignment(props)}
                onClick={({ props }) => {
                    const clickedEvent = (props as any).event;
                    const isSelected = selectedEventIds.includes(clickedEvent.id);
                    if (isSelected && selectedEventIds.length > 0) {
                        const selectedEvents = events.filter(e => selectedEventIds.includes(e.id));
                        handleAssignmentCopy(selectedEvents);
                    } else {
                        handleAssignmentCopy([clickedEvent]);
                    }
                }}
            >
                工事名コピー
            </Item>
            <Item
                hidden={({ props }) => isDummy(props) || !isAssignment(props)}
                onClick={({ props }) => {
                    const clickedEvent = (props as any).event;
                    const isSelected = selectedEventIds.includes(clickedEvent.id);
                    if (isSelected && selectedEventIds.length > 0) {
                        const selectedEvents = events.filter(e => selectedEventIds.includes(e.id));
                        handleAssignmentCut(selectedEvents);
                    } else {
                        handleAssignmentCut([clickedEvent]);
                    }
                }}
            >
                工事名切り取り
            </Item>
            <Item
                hidden={({ props }) => isDummy(props) || !isAssignment(props)}
                onClick={({ props }) => {
                    const clickedEvent = (props as any).event;
                    const isSelected = selectedEventIds.includes(clickedEvent.id);
                    if (isSelected && selectedEventIds.length > 0) {
                        const selectedEvents = events.filter(e => selectedEventIds.includes(e.id));
                        handleAssignmentDelete(selectedEvents);
                    } else {
                        handleAssignmentDelete([clickedEvent]);
                    }
                }}
            >
                工事名削除
            </Item>
            <Item
                hidden={({ props }) => isDummy(props) || getAssignmentsOnDay(props).length <= 1}
                onClick={({ props }) => {
                    const assignments = getAssignmentsOnDay(props);
                    const sorted = [...assignments].sort((a, b) => (a.extendedProps?.assignment_order ?? 0) - (b.extendedProps?.assignment_order ?? 0));
                    setReorderableAssignments(sorted);
                    setReorderDialogOpen(true);
                }}
            >
                この日の作業順を並び替え
            </Item>
            <Item
                onClick={({ props }) => {
                    const date = (props as any).date ? formatDate(new Date((props as any).date).toISOString()) : (props as any).event.startStr;
                    const resourceId = (props as any).resource?.id || (props as any).event.getResources()[0]?.id;
                    setOtherAssignmentDate(date);
                    setOtherAssignmentResourceId(resourceId);
                    setOtherAssignmentDialogOpen(true);
                }}
            >
                その他予定を追加
            </Item>
            <Item
                disabled={!clipboard}
                onClick={({ props }) => {
                    const date = (props as any).date ? formatDate(new Date((props as any).date).toISOString()) : (props as any).event.startStr;
                    const resourceId = (props as any).resource?.id || (props as any).event.getResources()[0]?.id;
                    handlePaste(resourceId, date);
                }}
            >
                工事名の貼付け
            </Item>
            <Item hidden={({ props }) => !isDummy(props) || isWorker(props)} onClick={({ props }) => handleBlockCopy((props as any).resource?.id, formatDate((props as any).date.toISOString()))}>
                ブロックコピー
            </Item>
            <Item hidden={({ props }) => !isDummy(props) || isWorker(props)} onClick={({ props }) => handleBlockCut((props as any).resource?.id, formatDate((props as any).date.toISOString()))}>
                ブロック切り取り
            </Item>
            <Item hidden={({ props }) => !isDummy(props) || isWorker(props)} onClick={({ props }) => handleBlockDelete((props as any).resource?.id, formatDate((props as any).date.toISOString()))}>
                ブロック削除
            </Item>
        </Menu>
    );
};