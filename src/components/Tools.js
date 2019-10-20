import React from 'react'

export class Tools {
  static getColor(percent) {
    switch (true) {
    case percent <= 50: return 'success'
    case percent <= 75: return 'warning'
    default: return 'danger'
    }
  }

  static getColorByCode(code) { 
    switch (Math.round(code/100)) {
    case 1: return 'info'
    case 2: return 'success'
    case 3: return 'warning'
    case 4: return 'dark'
    case 5: return 'danger'
    default: return 'secondary'
    }
  }

  static getProgressBar(value, color) {
    if(!value) return ''
    var precent = Math.round(value*100)
    var style = {
      width : `${precent}%`
    }
    return (
      <div className={'progress-bar bg-'+ (color ? color : Tools.getColor(precent))} 
        role="progressbar" aria-valuenow={precent}
        aria-valuemin="0" aria-valuemax="100" style={style}>
        {precent}%
      </div>
    )
  }

  static round(value, precision) {
    return Math.round(value*(10**precision))/(10**precision)
  }

  static getHumanTime(seconds) {
    if(!seconds) return ''
    var units = {
      'year': 365 * 86400,
      'day': 86400,
      'hour': 3600,
      'minute': 60,
      //'second': 1
    }
      
    var result = []
      
    for (let unit in units) {
      var divisor = units[unit]
      var div = Math.floor(seconds / divisor)
      
      if (div === 0) continue;
      else {
        if (div === 1) result.push(div + ' ' + unit)
        else result.push(div + ' ' + unit + 's')
        seconds %= divisor
      }
    }
      
    return result.join(' ')
  }

  static getHumanSize(bytes, precision=2) {
    if(!bytes) return ''
    var units = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
    var result = ''
    for (let unit of units) {
      if (bytes > 1024) bytes  /= 1024
      else {
        result = unit
        break
      }
    }
    return `${Tools.round(bytes,precision)}\u00A0${result}B`
  }

}
