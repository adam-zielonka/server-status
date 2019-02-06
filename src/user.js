import * as jwt from 'jsonwebtoken'
import { APP_SECRET, USERS } from './config';

export function auth(parent, args, context) {
    if(!context.name) throw new Error('Not authenticated')
    return { auth : true }
}

export function getUserName(context) {
    const Authorization = context && context.req && context.req.headers.authorization
    if (Authorization) {
        const token = Authorization.replace('Bearer ', '')
        const { name } = jwt.verify(token, APP_SECRET)
        return { name }
    }
}

export function getUser(name) {
    return USERS.find(user => user.name === name)
}

export async function login(parent, args, context) {
    const user = getUser(args.name)
    if (!user) {
      throw new Error('No such user found')
    }

    if (args.pass !== user.pass) {
      throw new Error('Invalid password')
    }
  
    return {
      token: jwt.sign({ name: user.name }, APP_SECRET),
      user,
    }
}