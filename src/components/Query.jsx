import React, { useState, useEffect } from 'react'
import { Button, Card, Elevation } from '@blueprintjs/core'
import { observer } from 'mobx-react-lite'
import { useStore } from '../Store'

const Query = observer(({ title, query, children }) => {
  const { date, getData } = useStore()
  const [data, setData] = useState({})
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [queryDate, setQueryDate] = useState()

  const onClickHandler = async () => {
    if (!loading) {
      setLoading(true)
      const allQuery = `{
        sysinfo {
          data: ${query}
        }
      }`

      const { data, errors } = await getData({ query: allQuery })
      if (errors && errors.length) setError(true)
      else if (data && data.sysinfo) {
        setError(false)
        setData(data.sysinfo.data)
      }
      setLoading(false)
    }
  }

  useEffect(() => {
    if (queryDate !== date) {
      setQueryDate(date)
      onClickHandler()
    }
  }, [queryDate, date])

  const style = {
    boxShadow: '0 1px rgba(16,22,26,.15)',  
    height: '30px',
  }

  const cardStyle = {
    padding: 0,
  }

  const contentStyle = {
    padding: '10px',
  }

  return (
    <Card className='item' elevation={Elevation.TWO} style={cardStyle}>
      <div style={style}>
        <h3>
          <span style={{margin: '5px'}}>{title}</span>
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
