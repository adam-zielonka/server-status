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

  return Object.entries(units).reduce(([arr, sec], [unit, divisor]) => (
    [[...arr, [Math.floor(sec / divisor), unit]], sec % divisor]
  ), [[], seconds])[0].map(([value, unit]) => (
    !value ? '' : value + ' ' + unit + (value !== 1 ? 's' : '')
  )).reduce((arr, curr) => {
    if(arr.length === depth || !curr) return arr
    return [...arr, curr]
  }, []).filter(f => f).join(' ')
}

export function getHumanSize(bytes) {
  if(isNaN(bytes)) return '0\u00A0B'

  const prefix = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
    .find(p => p === 'Y' || !(bytes >= 1024 && (bytes /= 1024)))
  
  return [round(bytes), '\u00A0', prefix, 'B'].join('')
}
