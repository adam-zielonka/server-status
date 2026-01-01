import { useState, useEffect } from 'react'
import { Button, Card, Elevation } from '@blueprintjs/core'
import { observer } from 'mobx-react-lite'
import api from '../api/api'
import { store } from '../store/Store'

type QueryProps<T> = {
  title: string,
  children: (data: T) => React.ReactNode,
  path: string,
}

const Query = observer(<T,>({ title, children, path }: QueryProps<T>) => {
  const { date } = store
  const [data, setData] = useState<T>({} as T)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [queryDate, setQueryDate] = useState<Date>()

  const onClickHandler = async () => {
    if (!loading) {
      setLoading(true)

      const { data, errors } = await api.fetch<T>(path)
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
