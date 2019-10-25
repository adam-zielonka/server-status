import React from 'react'
import { Colors } from '@blueprintjs/core'

function getColor(percent) {
  switch (true) {
  case percent <= 50: return  Colors.GREEN3
  case percent <= 75: return  Colors.ORANGE3
  default: return Colors.RED3
  }
}

export const ProgressMeter = ({ value = 0, color }) => {
  const percent = !isNaN(value) ? Math.round(value * 100) : 0

  return (
    <div className='bp3-progress-meter progress-meter' style={{ backgroundColor: color || getColor(percent), textAlign: color && 'right', width: (percent > 100 ? 100 : percent) + '%'}}>{percent}%</div>
  )
}

export const ProgressBar = ({ children }) => {

  return (
    <div className="bp3-progress-bar bp3-no-animation progress-bar" >
      {children}
    </div>
  )
}
