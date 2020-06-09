let pluginConfig = {
  // 'layout': [
  //   {
  //     'board-3': [
  //       {
  //         'div': [
  //           'system',
  //           'loadAverage'
  //         ]
  //       },
  //       {
  //         'div': [
  //           'memory',
  //           'fileSystem'
  //         ]
  //       }
  //     ]
  //   },
  //   {
  //     'div': [
  //       'pm2',
  //       'docker',
  //       {
  //         'board-2': [
  //           {
  //             'div': [
  //               'network',
  //               'services'
  //             ]
  //           },
  //           {
  //             'div': [
  //               'virtualHosts'
  //             ]
  //           }
  //         ]
  //       }
  //     ]
  //   }
  // ]
}

export const setConfig = config => pluginConfig = { ...pluginConfig, ...config }
export const getConfig = () => pluginConfig
