import { gql } from 'apollo-server'

export default gql`
  type AuthPayload {
    token: String
    user: User
  }

  type User {
    name: String
  }
`
