import Vue from 'vue'
import cronParser from 'cron-parser'
import { nanoid } from 'nanoid'

Vue.prototype.$randomId = (len = null) => {
  if (len && !isNaN(len)) return nanoid(len)
  return nanoid()
}

Vue.prototype.$bytesPretty = (bytes, decimals = 2) => {
  if (isNaN(bytes) || bytes == 0) {
    return '0 Bytes'
  }
  const k = 1000
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

Vue.prototype.$elapsedPretty = (seconds, useFullNames = false, useMilliseconds = false) => {
  if (useMilliseconds && seconds > 0 && seconds < 1) {
    return `${Math.floor(seconds * 1000)} ms`
  }
  if (seconds < 60) {
    return `${Math.floor(seconds)} sec${useFullNames ? 'onds' : ''}`
  }
  var minutes = Math.floor(seconds / 60)
  if (minutes < 70) {
    return `${minutes} min${useFullNames ? `ute${minutes === 1 ? '' : 's'}` : ''}`
  }
  var hours = Math.floor(minutes / 60)
  minutes -= hours * 60
  if (!minutes) {
    return `${hours} ${useFullNames ? 'hours' : 'hr'}`
  }
  return `${hours} ${useFullNames ? `hour${hours === 1 ? '' : 's'}` : 'hr'} ${minutes} ${useFullNames ? `minute${minutes === 1 ? '' : 's'}` : 'min'}`
}

Vue.prototype.$secondsToTimestamp = (seconds, includeMs = false, alwaysIncludeHours = false) => {
  if (!seconds) {
    return alwaysIncludeHours ? '00:00:00' : '0:00'
  }
  var _seconds = seconds
  var _minutes = Math.floor(seconds / 60)
  _seconds -= _minutes * 60
  var _hours = Math.floor(_minutes / 60)
  _minutes -= _hours * 60

  var ms = _seconds - Math.floor(seconds)
  _seconds = Math.floor(_seconds)

  var msString = includeMs ? '.' + ms.toFixed(3).split('.')[1] : ''
  if (alwaysIncludeHours) {
    return `${_hours.toString().padStart(2, '0')}:${_minutes.toString().padStart(2, '0')}:${_seconds.toString().padStart(2, '0')}${msString}`
  }
  if (!_hours) {
    return `${_minutes}:${_seconds.toString().padStart(2, '0')}${msString}`
  }
  return `${_hours}:${_minutes.toString().padStart(2, '0')}:${_seconds.toString().padStart(2, '0')}${msString}`
}

Vue.prototype.$elapsedPrettyExtended = (seconds, useDays = true, showSeconds = true) => {
  if (isNaN(seconds) || seconds === null) return ''
  seconds = Math.round(seconds)

  let minutes = Math.floor(seconds / 60)
  seconds -= minutes * 60
  let hours = Math.floor(minutes / 60)
  minutes -= hours * 60

  let days = 0
  if (useDays || Math.floor(hours / 24) >= 100) {
    days = Math.floor(hours / 24)
    hours -= days * 24
  }

  // If not showing seconds then round minutes up
  if (minutes && seconds && !showSeconds) {
    if (seconds >= 30) minutes++
  }

  const strs = []
  if (days) strs.push(`${days}d`)
  if (hours) strs.push(`${hours}h`)
  if (minutes) strs.push(`${minutes}m`)
  if (seconds && showSeconds) strs.push(`${seconds}s`)
  return strs.join(' ')
}

Vue.prototype.$parseCronExpression = (expression) => {
  if (!expression) return null
  const pieces = expression.split(' ')
  if (pieces.length !== 5) {
    return null
  }

  const commonPatterns = [
    {
      text: 'Every 12 hours',
      value: '0 */12 * * *'
    },
    {
      text: 'Every 6 hours',
      value: '0 */6 * * *'
    },
    {
      text: 'Every 2 hours',
      value: '0 */2 * * *'
    },
    {
      text: 'Every hour',
      value: '0 * * * *'
    },
    {
      text: 'Every 30 minutes',
      value: '*/30 * * * *'
    },
    {
      text: 'Every 15 minutes',
      value: '*/15 * * * *'
    },
    {
      text: 'Every minute',
      value: '* * * * *'
    }
  ]
  const patternMatch = commonPatterns.find((p) => p.value === expression)
  if (patternMatch) {
    return {
      description: patternMatch.text
    }
  }

  if (isNaN(pieces[0]) || isNaN(pieces[1])) {
    return null
  }
  if (pieces[2] !== '*' || pieces[3] !== '*') {
    return null
  }
  if (pieces[4] !== '*' && pieces[4].split(',').some((p) => isNaN(p))) {
    return null
  }

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  var weekdayText = 'day'
  if (pieces[4] !== '*')
    weekdayText = pieces[4]
      .split(',')
      .map((p) => weekdays[p])
      .join(', ')

  return {
    description: `Run every ${weekdayText} at ${pieces[1]}:${pieces[0].padStart(2, '0')}`
  }
}

Vue.prototype.$getNextScheduledDate = (expression) => {
  const interval = cronParser.parseExpression(expression)
  return interval.next().toDate()
}

Vue.prototype.$downloadFile = (url, filename = null, openInNewTab = false) => {
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url

  if (filename) {
    a.download = filename
  }
  if (openInNewTab) {
    a.target = '_blank'
  }

  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    a.remove()
  })
}

export function supplant(str, subs) {
  // source: http://crockford.com/javascript/remedial.html
  return str.replace(/{([^{}]*)}/g, function (a, b) {
    var r = subs[b]
    return typeof r === 'string' || typeof r === 'number' ? r : a
  })
}
