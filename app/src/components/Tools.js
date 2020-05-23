export function round(value, precision = 2) {
  return Math.round(value*(10**precision))/(10**precision)
}

export function getHumanTime(seconds, depth = 2) {
  if(!seconds) return ''
  const units = {
    'year': 365 * 86400,
    'day': 86400,
    'hour': 3600,
    'minute': 60,
    'second': 1,
  }

  const spreadTime = ([arr, sec], [unit, divisor]) => [[...arr, [Math.floor(sec / divisor), unit]], sec % divisor]
  const addDescription = ([value, unit]) => !value ? '' : value + ' ' + unit + (value !== 1 ? 's' : '')
  const selectForDepth = (arr, curr) => arr.length === depth || !curr ? arr : [...arr, curr]

  return Object.entries(units)
    .reduce(spreadTime, [[], seconds])[0]
    .map(addDescription)
    .reduce(selectForDepth, [])
    .filter(f => f)
    .join(' ')
}

export function getHumanSize(bytes) {
  if(isNaN(bytes)) return '0\u00A0B'

  const prefix = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
    .find(p => p === 'Y' || !(bytes >= 1024 && (bytes /= 1024)))
  
  return [round(bytes), '\u00A0', prefix, 'B'].join('')
}
