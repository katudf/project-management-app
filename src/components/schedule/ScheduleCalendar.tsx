import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import jaLocale from '@fullcalendar/core/locales/ja';
import type { EventContentArg, EventMountArg, DatesSetArg, EventDragStartArg, EventDropArg, EventResizeDoneArg, DropInfo, EventAllowArg, EventClickArg } from '@fullcalendar/core';
import type { CalendarEvent, Resource } from '@/types/schedule';
import { EVENT_CLASS_NAME } from '@/constants/scheduleConstants';
import { getDayClasses } from '@/utils/uiUtils';

interface ScheduleCalendarProps {
    calendarRef: React.RefObject<FullCalendar>;
    resources: Resource[];
    events: CalendarEvent[];
    companyHolidays: { id: number; date: string; description: string; }[];
    selectedEventIds: string[];
    onDatesSet: (arg: DatesSetArg) => void;
    onEventDrop: (arg: EventDropArg) => void;
    onEventResize: (arg: EventResizeDoneArg) => void;
    onEventClick: (arg: EventClickArg) => void;
    onEventDragStart: (arg: EventDragStartArg) => void;
    onEventDragStop: () => void;
    onEventAllow: (dropInfo: DropInfo, draggedEvent: any) => boolean;
    onEventMount: (mountInfo: EventMountArg) => void;
    setReorderableResources: (resources: Resource[]) => void;
    setReorderResourceDialogOpen: (open: boolean) => void;
}

const renderEventContent = (eventInfo: EventContentArg) => {
    if (eventInfo.event.extendedProps.isDummy) return true;
    const { event } = eventInfo;
    const title = event.title;
    const isAssignment = event.classNames.includes(EVENT_CLASS_NAME.ASSIGNMENT);
    
    const classNames = [
      isAssignment ? "assignment-event-title" : "event-title"
    ].filter(Boolean).join(" ");

    const style = { color: event.textColor };
    return <div className={classNames} style={style}>{title}</div>;
};

export const ScheduleCalendar = (props: ScheduleCalendarProps) => {
    const {
        calendarRef,
        resources,
        events,
        companyHolidays,
        selectedEventIds,
        onDatesSet,
        onEventDrop,
        onEventResize,
        onEventClick,
        onEventDragStart,
        onEventDragStop,
        onEventAllow,
        onEventMount,
        setReorderableResources,
        setReorderResourceDialogOpen,
    } = props;

    return (
        <FullCalendar
            ref={calendarRef}
            key={resources.map(r => r.id).join('-')}
            plugins={[resourceTimelinePlugin, interactionPlugin]}
            schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
            locale={jaLocale}
            initialView='resourceTimelineWeekRange'
            visibleRange={(() => {
                const today = new Date();
                const dayOfWeek = today.getDay();
                const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const mondayOfCurrentWeek = new Date(today.setDate(today.getDate() - diff));
                const sixMonthsLater = new Date(mondayOfCurrentWeek);
                sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
                return {
                    start: mondayOfCurrentWeek.toISOString().split('T')[0],
                    end: sixMonthsLater.toISOString().split('T')[0]
                };
            })()}
            headerToolbar={{ left: '', center: '', right: '' }}
            datesSet={onDatesSet}
            views={{
                resourceTimelineWeekRange: {
                    type: 'resourceTimeline',
                    buttonText: '6ヶ月'
                },
            }}
            editable={true}
            resources={resources}
            resourceGroupField="group"
            resourceOrder="group,order"
            events={events}
            eventOrder="extendedProps.assignment_order"
            eventResizableFromStart={true}
            eventDrop={onEventDrop}
            eventResize={onEventResize}
            eventContent={renderEventContent}
            eventDidMount={onEventMount}
            eventClassNames={arg => selectedEventIds.includes(arg.event.id) ? ['selected-event'] : []}
            eventClick={onEventClick}
            eventDragStart={onEventDragStart}
            eventDragStop={onEventDragStop}
            eventAllow={onEventAllow}
            resourceAreaColumns={[
                {
                    headerContent: 'リソース名',
                    cellContent: (arg) => {
                        const { resource } = arg;
                        if (resource._resource.extendedProps && resource._resource.extendedProps.group === 'workers') {
                            const { birthDate, age } = resource._resource.extendedProps;
                            const birthDateStr = birthDate ? new Date(birthDate).toLocaleDateString('ja-JP') : '';
                            const ageStr = age !== undefined ? `(${age}歳)` : '';
                            return (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', p: '4px', height: '100%', justifyContent: 'center' }}>
                                    <Typography variant="body2">{resource.title}</Typography>
                                    <Typography variant="caption" color="textSecondary">
                                        {birthDateStr} {ageStr}
                                    </Typography>
                                </Box>
                            );
                        }
                        return <Box sx={{ p: '4px', display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'flex-start' }}><Typography variant="body2">{resource.title}</Typography></Box>;
                    }
                }
            ]}
            resourceGroupLabelContent={(groupInfo) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexGrow: 1, pl: 1 }}>
                    <Typography variant="subtitle2">{groupInfo.groupValue === 'projects' ? '案件名' : '作業員名'}</Typography>
                    <Button size="small" variant="outlined" sx={{ fontSize: '0.75rem', minWidth: 0, p: '2px 6px', ml: '2em' }} onClick={() => {
                        const filtered = resources.filter(r => r.group === groupInfo.groupValue);
                        setReorderableResources(filtered);
                        setReorderResourceDialogOpen(true);
                    }}>並び替え</Button>
                </Box>
            )}
            slotLaneDidMount={(info) => getDayClasses({ date: info.date } as any, companyHolidays).forEach(cls => info.el.classList.add(cls))}
            slotLabelDidMount={(info) => getDayClasses({ date: info.date } as any, companyHolidays).forEach(cls => info.el.classList.add(cls))}
            slotMinWidth={60}
            resourceAreaWidth="250px"
            dragScroll={true}
        />
    );
};