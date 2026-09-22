/**
 * Строит фактический временной диапазон колонки. `min` и `max` задают
 * время суток, поэтому конец, который не позже начала, относится к следующим
 * календарным суткам.
 */
export function getTimeGridColumnRange(date, min, max, localizer) {
  const start = localizer.merge(date, min)
  let end = localizer.merge(date, max)

  if (+end <= +start) {
    end = localizer.add(end, 1, 'day')
  }

  return { start, end }
}

/**
 * Проверяет пересечение события с колонкой как пересечение реальных
 * временных интервалов с исключающей правой границей. Это не позволяет
 * событию на стыке двух полных суток попасть сразу в обе колонки.
 */
export function timeRangeIntersects(start, end, rangeStart, rangeEnd) {
  const startTime = +start
  const endTime = +end
  const rangeStartTime = +rangeStart
  const rangeEndTime = +rangeEnd

  if (startTime === endTime) {
    return startTime >= rangeStartTime && startTime < rangeEndTime
  }

  return startTime < rangeEndTime && endTime > rangeStartTime
}

/**
 * Определяет, помещается ли событие целиком в одну временную колонку.
 * Это сохраняет смысл `showMultiDayTimes` для суток с произвольной границей.
 */
export function timeRangeFits(start, end, rangeStart, rangeEnd) {
  return +start >= +rangeStart && +end <= +rangeEnd
}

/**
 * Проверяет принадлежность момента колонке с исключающей правой границей,
 * чтобы соседние колонки не показывали два индикатора текущего времени.
 */
export function timeRangeContains(time, rangeStart, rangeEnd) {
  return +time >= +rangeStart && +time < +rangeEnd
}
