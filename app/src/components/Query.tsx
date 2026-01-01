import { useState, useEffect } from 'react'
import { Button, Card, Elevation } from '@blueprintjs/core'
import { observer } from 'mobx-react-lite'
import { useStore } from '../Store'
import api from '../api'

type QueryProps = {
  title: string,
  children: (data: unknown) => React.ReactNode,
  path: string,
}

const Query = observer(({ title, children, path }: QueryProps) => {
  const { date } = useStore()
  const [data, setData] = useState({})
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [queryDate, setQueryDate] = useState<Date>()

  const onClickHandler = async () => {
    if (!loading) {
      setLoading(true)

      const { data, errors } = await api.fetch(path)
      if (errors && errors.length) {
        setError(errors.map(e => e).join(', '))
      }
      else if (data) {
        setError(undefined)
        setData(data)
      }
      setLoading(false)
    }
  }

  useEffect(() => {
    if (queryDate !== date) {
      setQueryDate(date)
      onClickHandler()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDate, date])

  const style = {
    boxShadow: '0 1px rgba(16,22,26,.15)',  
    height: '30px',
  }

  const cardStyle = {
    padding: 0,
  }

  const contentStyle: React.CSSProperties = {
    padding: '10px',
    opacity: loading || error ? 0.4 : 1,
    overflowX: 'auto',
    overflowY: 'hidden',
    whiteSpace: 'nowrap',
  }

  return (
    <Card className="item" elevation={Elevation.TWO} style={cardStyle}>
      <div style={style}>
        <h3 className="center-parent" style={{width: '100%', paddingLeft: '5px'}}>
          <span className="center-child">{title}</span>
          <span style={{
            color: '#909090ff',
            fontSize: '10px',
          }}>{error || ''}</span>
          <Button loading={loading} intent={error ? 'danger' : 'none'} minimal icon={error ? 'warning-sign' : 'refresh'} style={{ float: 'right' }} onClick={onClickHandler} />
        </h3>
      </div>
      <div style={contentStyle}>
        {children(data)}
      </div>
    </Card>
  )
})

export default Query
