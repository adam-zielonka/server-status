import { gql } from 'apollo-server'

export default gql`
  type VHost {
    port: String
    name: String
    statusCode: String
  }

  type Apache2 {
    vhosts: [VHost]
  }
`
