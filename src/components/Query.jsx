import React, { useState, useEffect } from 'react'
import { Button, Card, Elevation } from '@blueprintjs/core'
import { observer } from 'mobx-react-lite'
import { useStore } from '../Store'

const Query = observer(({ title, query, query2, children }) => {
  const { date, getData } = useStore()
  const [data, setData] = useState({})
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [queryDate, setQueryDate] = useState()
  const [sQuery, setSQuery] = useState(query)

  const onClickHandler = async () => {
    if (!loading) {
      setLoading(true)

      let { data, errors } = await getData({ query: sQuery })
      if (errors && errors.length && query2) {
        const response = await getData({ query: query2 })
        data = response.data
        errors = response.errors
        if (!(errors && errors.length)) {
          setSQuery(query2)
        }
      }
      if (errors && errors.length && query) {
        const response = await getData({ query: query })
        data = response.data
        errors = response.errors
        if (!(errors && errors.length)) {
          setSQuery(query)
        }
      }
      if (errors && errors.length) {
        setError(true)
      }
      else if (data) {
        setError(false)
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

  const contentStyle = {
    padding: '10px',
    opacity: loading || error ? 0.4 : 1
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
