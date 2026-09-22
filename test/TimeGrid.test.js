import moment from 'moment'
import TimeGrid from '../src/TimeGrid'
import momentLocalizer from '../src/localizers/moment'

const localizer = momentLocalizer(moment)
const accessors = {
  start: (event) => event.start,
  end: (event) => event.end,
  allDay: (event) => event.allDay,
  resource: (event) => event.resourceId,
}

describe('TimeGrid overnight columns', () => {
  test('renders only events intersecting the actual overnight range', () => {
    const date = new Date(2018, 0, 29)
    const now = new Date(2018, 0, 30, 2, 0, 0)
    const visibleEvent = {
      start: new Date(2018, 0, 29, 23, 0, 0),
      end: new Date(2018, 0, 30, 1, 0, 0),
    }
    const events = [
      {
        start: new Date(2018, 0, 29, 2, 0, 0),
        end: new Date(2018, 0, 29, 3, 0, 0),
      },
      visibleEvent,
      {
        start: new Date(2018, 0, 30, 4, 0, 0),
        end: new Date(2018, 0, 30, 5, 0, 0),
      },
    ]
    const grid = new TimeGrid({
      min: new Date(1970, 0, 1, 4, 0, 0),
      max: new Date(1970, 0, 1, 3, 59, 0),
      localizer,
      step: 60,
      getNow: () => now,
      accessors,
      getters: {},
      onSelectSlot: () => {},
      onSelectEvent: () => {},
      onDoubleClickEvent: () => {},
    })
    const column = grid.renderDayColumn(
      date,
      'crane',
      {},
      new Map([['crane', events]]),
      new Map([['crane', events]]),
      localizer,
      accessors,
      {},
      'overlap',
      now
    )

    expect(column.props.min).toEqual(new Date(2018, 0, 29, 4, 0, 0))
    expect(column.props.max).toEqual(new Date(2018, 0, 30, 3, 59, 0))
    expect(column.props.events).toEqual([visibleEvent])
    expect(column.props.backgroundEvents).toEqual([visibleEvent])
    expect(column.props.isNow).toBe(true)
  })

  test('calculates auto-scroll inside the overnight range', () => {
    const props = {
      range: [new Date(2018, 0, 29)],
      min: new Date(1970, 0, 1, 4, 0, 0),
      max: new Date(1970, 0, 1, 3, 59, 0),
      scrollToTime: new Date(1970, 0, 1, 2, 0, 0),
      localizer,
    }
    const grid = new TimeGrid(props)

    grid.calculateScroll()

    expect(grid._scrollRatio).toBeGreaterThan(0.9)
    expect(grid._scrollRatio).toBeLessThan(1)
  })

  test('keeps an event crossing midnight in the timed column', () => {
    const date = new Date(2018, 0, 29)
    const now = new Date(2018, 0, 30, 2, 0, 0)
    const event = {
      start: new Date(2018, 0, 29, 23, 0, 0),
      end: new Date(2018, 0, 30, 1, 0, 0),
    }
    const backgroundEvent = {
      start: new Date(2018, 0, 30, 2, 0, 0),
      end: new Date(2018, 0, 30, 3, 0, 0),
    }
    const props = {
      events: [event],
      backgroundEvents: [backgroundEvent],
      range: [date],
      width: 100,
      getNow: () => now,
      components: {},
      accessors,
      getters: {},
      localizer,
      min: new Date(1970, 0, 1, 4, 0, 0),
      max: new Date(1970, 0, 1, 3, 59, 0),
      scrollToTime: new Date(1970, 0, 1, 4, 0, 0),
      showMultiDayTimes: false,
      longPressThreshold: 250,
      resourceGroupingLayout: false,
      dayLayoutAlgorithm: 'overlap',
      step: 60,
      timeslots: 1,
      getDrilldownView: () => null,
      allDayMaxRows: Infinity,
      popup: false,
    }
    const grid = new TimeGrid(props)
    let renderedEvents
    grid.renderEvents = (...args) => {
      renderedEvents = args
      return null
    }

    const view = grid.render()

    expect(renderedEvents).toEqual([[date], [event], [backgroundEvent], now])
    expect(view.props.children[0].props.events).toEqual([])
    expect(view.props.children[0].props.getNow()).toEqual(
      new Date(2018, 0, 29, 2, 0, 0)
    )
  })
})
