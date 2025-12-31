let pluginConfig = {
  users: [
    {
      name: 'pancake',
      pass: 'pancake',
    }
  ],
  secret: 'pancake-is-the-best-dragon',
}

export const setConfig = config => pluginConfig = { ...pluginConfig, ...config }
export const getConfig = () => pluginConfig
