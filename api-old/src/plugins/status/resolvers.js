import { getConfig } from './config'

export const ServerStatus = {
  plugins: (p, a, { plugins }) => plugins,
  layout: () => JSON.stringify(getConfig().layout),
} 
