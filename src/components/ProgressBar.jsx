import React from 'react'

function getColor(percent) {
  switch (true) {
  case percent <= 50: return 'green'
  case percent <= 75: return 'orange'
  default: return 'red'
  }
}

export const ProgressMeter = ({ value = 0, color }) => {
  const percent = !isNaN(value) ? Math.round(value * 100) : 0

  return (
    <div className='progress-meter' style={{ backgroundColor: color || getColor(percent), width: (value*100 > 100 ? 100 : value*100) + '%'}}>{percent}%</div>
  )
}

export const ProgressBar = ({ children }) => {

  return (
    <div className="progress-bar" >
      {children}
    </div>
  )
}
