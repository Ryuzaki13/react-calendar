import clsx from 'clsx'
import * as animationFrame from 'dom-helpers/animationFrame'
import memoize from 'memoize-one'
import PropTypes from 'prop-types'
import React, { Component, createRef } from 'react'

import getPosition from 'dom-helpers/position'
import getWidth from 'dom-helpers/width'
import DayColumn from './DayColumn'
import PopOverlay from './PopOverlay'
import TimeGridHeader from './TimeGridHeader'
import TimeGridHeaderResources from './TimeGridHeaderResources'
import TimeGutter from './TimeGutter'
import { views } from './utils/constants'
import { inRange, sortEvents } from './utils/eventLevels'
import { notify } from './utils/helpers'
import { DayLayoutAlgorithmPropType } from './utils/propTypes'
import Resources from './utils/Resources'
import {
  getTimeGridColumnRange,
  timeRangeContains,
  timeRangeFits,
  timeRangeIntersects,
} from './utils/TimeGridRange'

export default class TimeGrid extends Component {
  constructor(props) {
    super(props)

    this.state = { gutterWidth: undefined, isOverflowing: null }

    this.scrollRef = React.createRef()
    this.contentRef = React.createRef()
    this.containerRef = React.createRef()
    this._scrollRatio = null
    this.gutterRef = createRef()
  }

  getSnapshotBeforeUpdate() {
    this.checkOverflow()
    return null
  }

  componentDidMount() {
    if (this.props.width == null) {
      this.measureGutter()
    }

    this.calculateScroll()
    this.applyScroll()

    window.addEventListener('resize', this.handleResize)
  }

  handleScroll = (e) => {
    if (this.scrollRef.current) {
      this.scrollRef.current.scrollLeft = e.target.scrollLeft
    }
  }

  handleResize = () => {
    animationFrame.cancel(this.rafHandle)
    this.rafHandle = animationFrame.request(this.checkOverflow)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize)

    animationFrame.cancel(this.rafHandle)

    if (this.measureGutterAnimationFrameRequest) {
      window.cancelAnimationFrame(this.measureGutterAnimationFrameRequest)
    }
  }

  componentDidUpdate() {
    this.applyScroll()
  }

  handleKeyPressEvent = (...args) => {
    this.clearSelection()
    notify(this.props.onKeyPressEvent, args)
  }

  handleSelectEvent = (...args) => {
    //cancel any pending selections so only the event click goes through.
    this.clearSelection()
    notify(this.props.onSelectEvent, args)
  }

  handleDoubleClickEvent = (...args) => {
    this.clearSelection()
    notify(this.props.onDoubleClickEvent, args)
  }

  handleShowMore = (events, date, cell, slot, target) => {
    const {
      popup,
      onDrillDown,
      onShowMore,
      getDrilldownView,
      doShowMoreDrillDown,
    } = this.props
    this.clearSelection()

    if (popup) {
      let position = getPosition(cell, this.containerRef.current)

      this.setState({
        overlay: {
          date,
          events,
          position: { ...position, width: '200px' },
          target,
        },
      })
    } else if (doShowMoreDrillDown) {
      notify(onDrillDown, [date, getDrilldownView(date) || views.DAY])
    }

    notify(onShowMore, [events, date, slot])
  }

  handleSelectAllDaySlot = (slots, slotInfo) => {
    const { onSelectSlot } = this.props

    const start = new Date(slots[0])
    const end = new Date(slots[slots.length - 1])
    end.setDate(slots[slots.length - 1].getDate() + 1)

    notify(onSelectSlot, {
      slots,
      start,
      end,
      action: slotInfo.action,
      resourceId: slotInfo.resourceId,
    })
  }

  getColumnRange(date, props = this.props) {
    const { min, max, localizer } = props
    return getTimeGridColumnRange(date, min, max, localizer)
  }

  renderDayColumn(
    date,
    id,
    resource,
    groupedEvents,
    groupedBackgroundEvents,
    localizer,
    accessors,
    components,
    dayLayoutAlgorithm,
    now
  ) {
    const { start, end } = this.getColumnRange(date)

    let daysEvents = (groupedEvents.get(id) || []).filter((event) =>
      timeRangeIntersects(
        accessors.start(event),
        accessors.end(event),
        start,
        end
      )
    )

    let daysBackgroundEvents = (groupedBackgroundEvents.get(id) || []).filter(
      (event) =>
        timeRangeIntersects(
          accessors.start(event),
          accessors.end(event),
          start,
          end
        )
    )

    return (
      <DayColumn
        {...this.props}
        localizer={localizer}
        min={start}
        max={end}
        resource={resource && id}
        components={components}
        isNow={timeRangeContains(now, start, end)}
        key={`${id}-${date}`}
        date={date}
        events={daysEvents}
        backgroundEvents={daysBackgroundEvents}
        dayLayoutAlgorithm={dayLayoutAlgorithm}
      />
    )
  }

  renderResourcesFirst(
    range,
    resources,
    groupedEvents,
    groupedBackgroundEvents,
    localizer,
    accessors,
    now,
    components,
    dayLayoutAlgorithm
  ) {
    return resources.map(([id, resource]) =>
      range.map((date) =>
        this.renderDayColumn(
          date,
          id,
          resource,
          groupedEvents,
          groupedBackgroundEvents,
          localizer,
          accessors,
          components,
          dayLayoutAlgorithm,
          now
        )
      )
    )
  }

  renderRangeFirst(
    range,
    resources,
    groupedEvents,
    groupedBackgroundEvents,
    localizer,
    accessors,
    now,
    components,
    dayLayoutAlgorithm
  ) {
    return range.map((date) => (
      <div style={{ display: 'flex', minHeight: '100%', flex: 1 }} key={date}>
        {resources.map(([id, resource]) => (
          <div style={{ flex: 1 }} key={accessors.resourceId(resource)}>
            {this.renderDayColumn(
              date,
              id,
              resource,
              groupedEvents,
              groupedBackgroundEvents,
              localizer,
              accessors,
              components,
              dayLayoutAlgorithm,
              now
            )}
          </div>
        ))}
      </div>
    ))
  }

  renderEvents(range, events, backgroundEvents, now) {
    let {
      accessors,
      localizer,
      resourceGroupingLayout,
      components,
      dayLayoutAlgorithm,
    } = this.props

    const resources = this.memoizedResources(this.props.resources, accessors)
    const groupedEvents = resources.groupEvents(events)
    const groupedBackgroundEvents = resources.groupEvents(backgroundEvents)

    if (!resourceGroupingLayout) {
      return this.renderResourcesFirst(
        range,
        resources,
        groupedEvents,
        groupedBackgroundEvents,
        localizer,
        accessors,
        now,
        components,
        dayLayoutAlgorithm
      )
    } else {
      return this.renderRangeFirst(
        range,
        resources,
        groupedEvents,
        groupedBackgroundEvents,
        localizer,
        accessors,
        now,
        components,
        dayLayoutAlgorithm
      )
    }
  }

  render() {
    let {
      events,
      backgroundEvents,
      range,
      width,
      rtl,
      selected,
      getNow,
      resources,
      components,
      accessors,
      getters,
      localizer,
      showMultiDayTimes,
      longPressThreshold,
      resizable,
      resourceGroupingLayout,
    } = this.props

    width = width || this.state.gutterWidth

    let start = range[0],
      end = range[range.length - 1]

    this.slots = range.length

    let allDayEvents = [],
      rangeEvents = [],
      rangeBackgroundEvents = []

    const columnRanges = range.map((date) => this.getColumnRange(date))
    const now = getNow()
    const currentColumnIndex = columnRanges.findIndex(({ start, end }) =>
      timeRangeContains(now, start, end)
    )
    // Заголовок отмечает операционные сутки, которым принадлежит текущий
    // момент, даже если календарная дата уже сменилась после полуночи.
    const headerNow =
      currentColumnIndex === -1
        ? now
        : localizer.merge(range[currentColumnIndex], now)
    const getHeaderNow = () => headerNow

    const intersectsColumn = (event) => {
      const eventStart = accessors.start(event)
      const eventEnd = accessors.end(event)

      return columnRanges.some(({ start, end }) =>
        timeRangeIntersects(eventStart, eventEnd, start, end)
      )
    }

    const fitsColumn = (event) => {
      const eventStart = accessors.start(event)
      const eventEnd = accessors.end(event)

      return columnRanges.some(({ start, end }) =>
        timeRangeFits(eventStart, eventEnd, start, end)
      )
    }

    events.forEach((event) => {
      const eStart = accessors.start(event)
      const eEnd = accessors.end(event)
      const isAllDay =
        accessors.allDay(event) ||
        localizer.startAndEndAreDateOnly(eStart, eEnd)

      if (isAllDay) {
        if (inRange(event, start, end, accessors, localizer)) {
          allDayEvents.push(event)
        }
        return
      }

      if (!intersectsColumn(event)) return

      if (!showMultiDayTimes && !fitsColumn(event)) {
        allDayEvents.push(event)
      } else {
        rangeEvents.push(event)
      }
    })

    backgroundEvents.forEach((event) => {
      if (intersectsColumn(event)) {
        rangeBackgroundEvents.push(event)
      }
    })

    allDayEvents.sort((a, b) => sortEvents(a, b, accessors, localizer))

    const gutterRange = this.getColumnRange(start)

    const headerProps = {
      range,
      events: allDayEvents,
      width,
      rtl,
      getNow: getHeaderNow,
      localizer,
      selected,
      allDayMaxRows: this.props.showAllEvents
        ? Infinity
        : this.props.allDayMaxRows ?? Infinity,
      resources: this.memoizedResources(resources, accessors),
      selectable: this.props.selectable,
      accessors,
      getters,
      components,
      scrollRef: this.scrollRef,
      isOverflowing: this.state.isOverflowing,
      longPressThreshold,
      onSelectSlot: this.handleSelectAllDaySlot,
      onSelectEvent: this.handleSelectEvent,
      onShowMore: this.handleShowMore,
      onDoubleClickEvent: this.props.onDoubleClickEvent,
      onKeyPressEvent: this.props.onKeyPressEvent,
      onDrillDown: this.props.onDrillDown,
      getDrilldownView: this.props.getDrilldownView,
      resizable,
    }

    return (
      <div
        className={clsx(
          'rbc-time-view',
          resources && 'rbc-time-view-resources'
        )}
        ref={this.containerRef}
      >
        {resources && resources.length > 1 && resourceGroupingLayout ? (
          <TimeGridHeaderResources {...headerProps} />
        ) : (
          <TimeGridHeader {...headerProps} />
        )}
        {this.props.popup && this.renderOverlay()}
        <div
          ref={this.contentRef}
          className="rbc-time-content"
          onScroll={this.handleScroll}
        >
          <TimeGutter
            date={start}
            ref={this.gutterRef}
            localizer={localizer}
            min={gutterRange.start}
            max={gutterRange.end}
            step={this.props.step}
            getNow={this.props.getNow}
            timeslots={this.props.timeslots}
            components={components}
            className="rbc-time-gutter"
            getters={getters}
          />
          {this.renderEvents(range, rangeEvents, rangeBackgroundEvents, now)}
        </div>
      </div>
    )
  }

  renderOverlay() {
    let overlay = this.state?.overlay ?? {}
    let {
      accessors,
      localizer,
      components,
      getters,
      selected,
      popupOffset,
      handleDragStart,
    } = this.props

    const onHide = () => this.setState({ overlay: null })

    return (
      <PopOverlay
        overlay={overlay}
        accessors={accessors}
        localizer={localizer}
        components={components}
        getters={getters}
        selected={selected}
        popupOffset={popupOffset}
        ref={this.containerRef}
        handleKeyPressEvent={this.handleKeyPressEvent}
        handleSelectEvent={this.handleSelectEvent}
        handleDoubleClickEvent={this.handleDoubleClickEvent}
        handleDragStart={handleDragStart}
        show={!!overlay.position}
        overlayDisplay={this.overlayDisplay}
        onHide={onHide}
      />
    )
  }

  overlayDisplay = () => {
    this.setState({
      overlay: null,
    })
  }

  clearSelection() {
    clearTimeout(this._selectTimer)
    this._pendingSelection = []
  }

  measureGutter() {
    if (this.measureGutterAnimationFrameRequest) {
      window.cancelAnimationFrame(this.measureGutterAnimationFrameRequest)
    }
    this.measureGutterAnimationFrameRequest = window.requestAnimationFrame(
      () => {
        const width = this.gutterRef?.current
          ? getWidth(this.gutterRef.current)
          : undefined

        if (width && this.state.gutterWidth !== width) {
          this.setState({ gutterWidth: width })
        }
      }
    )
  }

  applyScroll() {
    // If auto-scroll is disabled, we don't actually apply the scroll
    if (this._scrollRatio != null && this.props.enableAutoScroll === true) {
      const content = this.contentRef.current
      content.scrollTop = content.scrollHeight * this._scrollRatio
      // Only do this once
      this._scrollRatio = null
    }
  }

  calculateScroll(props = this.props) {
    const { range, scrollToTime, localizer } = props

    if (!range.length) {
      this._scrollRatio = 0
      return
    }

    const { start, end } = this.getColumnRange(range[0], props)
    let scrollTarget = localizer.merge(range[0], scrollToTime)

    if (!localizer.isSameDate(start, end) && +scrollTarget < +start) {
      scrollTarget = localizer.add(scrollTarget, 1, 'day')
    }

    const totalMinutes = localizer.getTotalMin(start, end)
    let scrollMinutes = localizer.getTotalMin(start, scrollTarget)

    if (+scrollTarget <= +start) scrollMinutes = 0
    if (+scrollTarget >= +end) scrollMinutes = totalMinutes

    this._scrollRatio = totalMinutes > 0 ? scrollMinutes / totalMinutes : 0
  }

  checkOverflow = () => {
    if (this._updatingOverflow) return

    const content = this.contentRef.current

    if (!content?.scrollHeight) return
    let isOverflowing = content.scrollHeight > content.clientHeight

    if (this.state.isOverflowing !== isOverflowing) {
      this._updatingOverflow = true
      this.setState({ isOverflowing }, () => {
        this._updatingOverflow = false
      })
    }
  }

  memoizedResources = memoize((resources, accessors) =>
    Resources(resources, accessors)
  )
}

TimeGrid.propTypes = {
  events: PropTypes.array.isRequired,
  backgroundEvents: PropTypes.array.isRequired,
  resources: PropTypes.array,

  resourceGroupingLayout: PropTypes.bool,

  step: PropTypes.number,
  timeslots: PropTypes.number,
  range: PropTypes.arrayOf(PropTypes.instanceOf(Date)),
  min: PropTypes.instanceOf(Date).isRequired,
  max: PropTypes.instanceOf(Date).isRequired,
  getNow: PropTypes.func.isRequired,

  scrollToTime: PropTypes.instanceOf(Date).isRequired,
  enableAutoScroll: PropTypes.bool,
  showMultiDayTimes: PropTypes.bool,

  rtl: PropTypes.bool,
  resizable: PropTypes.bool,
  width: PropTypes.number,

  accessors: PropTypes.object.isRequired,
  components: PropTypes.object.isRequired,
  getters: PropTypes.object.isRequired,
  localizer: PropTypes.object.isRequired,

  allDayMaxRows: PropTypes.number,

  selected: PropTypes.object,
  selectable: PropTypes.oneOf([true, false, 'ignoreEvents']),
  longPressThreshold: PropTypes.number,

  onNavigate: PropTypes.func,
  onSelectSlot: PropTypes.func,
  onSelectEnd: PropTypes.func,
  onSelectStart: PropTypes.func,
  onSelectEvent: PropTypes.func,
  onShowMore: PropTypes.func,
  onDoubleClickEvent: PropTypes.func,
  onKeyPressEvent: PropTypes.func,
  onDrillDown: PropTypes.func,
  getDrilldownView: PropTypes.func.isRequired,

  dayLayoutAlgorithm: DayLayoutAlgorithmPropType,

  showAllEvents: PropTypes.bool,
  doShowMoreDrillDown: PropTypes.bool,

  popup: PropTypes.bool,
  handleDragStart: PropTypes.func,

  popupOffset: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.shape({
      x: PropTypes.number,
      y: PropTypes.number,
    }),
  ]),
}

TimeGrid.defaultProps = {
  step: 30,
  timeslots: 2,
  // To be compatible with old versions, default as `false`.
  resourceGroupingLayout: false,
}
