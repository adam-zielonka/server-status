import * as jwt from 'jsonwebtoken'
import { getConfig } from './config'

export function auth(parent, args, context, { fieldName }) {
  if(fieldName !== 'login' && !context.name) throw new Error('Not authenticated')
  return { auth : true }
}

export function getUserName(context) {
  const Authorization = context && context.req && context.req.headers.authorization
  if (Authorization) {
    const token = Authorization.replace('Bearer ', '')
    const { name } = jwt.verify(token, getConfig().secret)
    const user = getUser(name)
    if(user) return { ...context, name }
    else return context
  }
}

export function getUser(name) {
  return getConfig().users.find(user => user.name === name)
}

export async function login(parent, args) {
  const user = getUser(args.name)
  if (!user) {
    throw new Error('No such user found')
  }

  if (args.pass !== user.pass) {
    throw new Error('Invalid password')
  }
  
  return {
    token: jwt.sign({ name: user.name }, getConfig().secret),
    user,
  }
}
