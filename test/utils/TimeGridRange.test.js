import moment from 'moment'
import momentLocalizer from '../../src/localizers/moment'
import {
  getTimeGridColumnRange,
  timeRangeContains,
  timeRangeFits,
  timeRangeIntersects,
} from '../../src/utils/TimeGridRange'
import { getSlotMetrics } from '../../src/utils/TimeSlots'

const localizer = momentLocalizer(moment)

describe('getTimeGridColumnRange', () => {
  test('moves an earlier maximum to the next calendar day', () => {
    const { start, end } = getTimeGridColumnRange(
      new Date(2018, 0, 29),
      new Date(1970, 0, 1, 4, 0, 0),
      new Date(1970, 0, 1, 3, 59, 0),
      localizer
    )

    expect(start).toEqual(new Date(2018, 0, 29, 4, 0, 0))
    expect(end).toEqual(new Date(2018, 0, 30, 3, 59, 0))
  })

  test('treats equal minimum and maximum as a full day', () => {
    const { start, end } = getTimeGridColumnRange(
      new Date(2018, 0, 29),
      new Date(1970, 0, 1, 4, 0, 0),
      new Date(1970, 0, 1, 4, 0, 0),
      localizer
    )

    expect(start).toEqual(new Date(2018, 0, 29, 4, 0, 0))
    expect(end).toEqual(new Date(2018, 0, 30, 4, 0, 0))
  })
})

describe('time grid range predicates', () => {
  const rangeStart = new Date(2018, 0, 29, 4, 0, 0)
  const rangeEnd = new Date(2018, 0, 30, 3, 59, 0)

  test('includes an event after midnight in the previous column', () => {
    const start = new Date(2018, 0, 30, 2, 0, 0)
    const end = new Date(2018, 0, 30, 3, 0, 0)

    expect(timeRangeIntersects(start, end, rangeStart, rangeEnd)).toBe(true)
    expect(timeRangeFits(start, end, rangeStart, rangeEnd)).toBe(true)
  })

  test('excludes an event that begins after the column', () => {
    expect(
      timeRangeIntersects(
        new Date(2018, 0, 30, 4, 0, 0),
        new Date(2018, 0, 30, 5, 0, 0),
        rangeStart,
        rangeEnd
      )
    ).toBe(false)
  })

  test('excludes an event that begins exactly at the column end', () => {
    expect(
      timeRangeIntersects(
        rangeEnd,
        new Date(2018, 0, 30, 4, 30, 0),
        rangeStart,
        rangeEnd
      )
    ).toBe(false)
  })

  test('uses an exclusive end for the current time indicator', () => {
    expect(timeRangeContains(rangeStart, rangeStart, rangeEnd)).toBe(true)
    expect(timeRangeContains(rangeEnd, rangeStart, rangeEnd)).toBe(false)
  })
})

describe('overnight slot metrics', () => {
  const min = new Date(2018, 0, 29, 4, 0, 0)
  const max = new Date(2018, 0, 30, 3, 59, 0)
  const slotMetrics = getSlotMetrics({
    min,
    max,
    step: 60,
    timeslots: 1,
    localizer,
  })

  test('creates slots through the next calendar day', () => {
    expect(slotMetrics.groups).toHaveLength(24)
    expect(slotMetrics.groups[0][0]).toEqual(new Date(2018, 0, 29, 4, 0, 0))
    expect(slotMetrics.groups[23][0]).toEqual(new Date(2018, 0, 30, 3, 0, 0))
  })

  test('compares event boundaries using their actual dates', () => {
    expect(slotMetrics.startsBefore(new Date(2018, 0, 30, 2, 0, 0))).toBe(false)
    expect(slotMetrics.startsAfter(new Date(2018, 0, 30, 2, 0, 0))).toBe(false)
    expect(slotMetrics.startsBefore(new Date(2018, 0, 29, 3, 59, 0))).toBe(true)
    expect(slotMetrics.startsAfter(new Date(2018, 0, 30, 4, 0, 0))).toBe(true)
  })
})
