export const Badge = ({ children, color = 'gray', style = {} }) => {
  return <div className="badge" style={{ backgroundColor: color, ...style }}>
    {children}
  </div>
}
