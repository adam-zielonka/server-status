let pluginConfig = {
  services: [
    {
      name: 'ServerStatus',
      port: '4000',
    },
    {
      name: 'OneTwoThere',
      port: '123',
    },
  ],
  hosts: [
    'localhost'
  ]
}

export const setConfig = config => pluginConfig = { ...pluginConfig, ...config }
export const getConfig = () => pluginConfig
