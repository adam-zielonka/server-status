let pluginConfig = {
  // user: 'username',
  // pass: 'password',
}

export const setConfig = config => pluginConfig = { ...pluginConfig, ...config }
export const getConfig = () => pluginConfig
