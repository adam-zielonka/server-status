import { gql } from 'apollo-server'

export default gql`
  type Book {
    title: String
    author: String
  }

  type Query {
    books: [Book],
    date: String,
    book(id: Int): Book
  }
`