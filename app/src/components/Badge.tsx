type BadgeProps = {
  children: React.ReactNode,
  color?: string,
  style?: React.CSSProperties
}

export const Badge = ({ children, color = 'gray', style = {} }: BadgeProps) => {
  return <div className="badge" style={{ backgroundColor: color, ...style }}>
    {children}
  </div>
}
