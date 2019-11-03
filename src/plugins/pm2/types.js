import { gql } from 'apollo-server'

export default gql`
  type PM2_ENV {
    exec_mode: String
    status: String
    watch: Boolean
    pm_uptime: Float
    restart_time: Float
  }

  type PM2_monit {
    memory: Float
    cpu: Float
  }

  type PM2 {
    name: String
    pm2_env: PM2_ENV
    monit: PM2_monit
    pm_id: Float
  }
`
