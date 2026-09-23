import * as React from 'react'

import {
  Calendar,
  DateLocalizer,
  Views,
  components,
  momentLocalizer,
  type CalendarProps,
} from '../types'
import withDragAndDrop from '../types/dragAndDrop'

type CraneEvent = {
  start: Date
  end: Date
  title: string
  resourceId: string
}

type CraneResource = {
  resourceId: string
  resourceTitle: string
}

// Проверяем типы публичного API и расширения DnD без запуска браузерного кода.
const localizer: DateLocalizer = momentLocalizer({})
const calendarProps: CalendarProps<CraneEvent, CraneResource> = {
  localizer,
  events: [],
  resources: [],
  views: [Views.DAY],
  min: new Date(2026, 2, 10, 4),
  max: new Date(2026, 2, 11, 3, 59),
  components: { eventWrapper: components.eventWrapper },
}

const calendar: React.ReactElement = (
  <Calendar<CraneEvent, CraneResource> {...calendarProps} />
)
const DragAndDropCalendar = withDragAndDrop<CraneEvent, CraneResource>(Calendar)
const dragAndDropCalendar: React.ReactElement = (
  <DragAndDropCalendar {...calendarProps} />
)

void calendar
void dragAndDropCalendar
