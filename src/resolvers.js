const books = [
  {
    title: 'Harry Potter and the Chamber of Secrets',
    author: 'J.K. Rowling',
  },
  {
    title: 'Jurassic Park',
    author: 'Michael Crichton',
  },
]


export const Query = {
  books: () => books,
  date: () => (new Date()).toDateString(),
  book: (parent, args, context, info) => books[args.id]
}
