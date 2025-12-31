function getColor(percent) {
  switch (true) {
  case percent <= 50: return 'green'
  case percent <= 75: return 'orange'
  default: return 'red'
  }
}

export const ProgressMeter = ({ value = 0, color }) => {
  const newValue = !isNaN(value) ? value * 100 : 0
  const percent = Math.round(newValue)
  const width = (newValue > 100 ? 100 : newValue) + '%'

  return (
    <div className="progress-meter" style={{ backgroundColor: color || getColor(percent), width }}>{percent}%</div>
  )
}

export const ProgressBar = ({ children }) => {

  return (
    <div className="progress-bar" >
      {children}
    </div>
  )
}
