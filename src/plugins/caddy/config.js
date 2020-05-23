let pluginConfig = {
  // user: 'username',
  // pass: 'password',
  // external: 'https://...',
  // rootCAPath: '/root/.step/certs/root_ca.crt',
  port: 2019,
}

export const setConfig = config => pluginConfig = { ...pluginConfig, ...config }
export const getConfig = () => pluginConfig
