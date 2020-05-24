let pluginConfig = {
  some_config: true,
  // some_number: 42,
}

export const setConfig = config => pluginConfig = { ...pluginConfig, ...config }
export const getConfig = () => pluginConfig
