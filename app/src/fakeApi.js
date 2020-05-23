function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fakeApi() {
  await sleep(Math.floor(Math.random() * 10)*100 + 200)
  return {
    'data': {
      'login': {
        'token': 'token',
        'user': {
          'name': 'name'
        }
      },
      'serverstatus': {
        'plugins': [
          {
            'name': '@server-status/api-plugin-auth'
          },
          {
            'name': '@server-status/api-plugin-systeminformation'
          },
          {
            'name': '@server-status/api-plugin-pm2'
          },
          {
            'name': '@server-status/api-plugin-caddy'
          },
          {
            'name': '@server-status/api-plugin-services'
          }
        ]
      },
      'si': {
        'system': {
          'platform': 'linux',
          'distro': 'Debian GNU/Linux',
          'release': '10',
          'codename': 'buster',
          'kernel': '4.19.0-8-amd64',
          'arch': 'x64',
          'hostname': 'example.com'
        },
        'cpu': {
          'manufacturer': 'Intel®',
          'brand': 'Xeon® E5-2650L v4',
          'speed': '1.70',
          'cores': 1
        },
        'time': {
          'current': 1584211997894,
          'uptime': 190131200,
          'timezone': 'GMT+0000',
          'timezoneName': 'Greenwich Mean Time'
        },
        'loadAverage': [
          0.76 + Math.floor(Math.random() * 30)/100,
          0.51 + Math.floor(Math.random() * 24)/100,
          0.01 + Math.floor(Math.random() * 49)/100,
        ],
        'memory': {
          'total': 1034330112,
          'free': 290357248,
          'used': 743972864,
          'active': 637571072,
          'available': 396759040,
          'buffcache': 289873920,
          'swaptotal': 1073737728,
          'swapused': 438566912,
          'swapfree': 635170816
        },
        'fs': [
          {
            'fs': '/dev/mapper/vg-lv_root',
            'type': 'ext4',
            'size': 19755368448,
            'used': 4694351872,
            'use': 23.76,
            'mount': '/'
          },
          {
            'fs': '/dev/sda1',
            'type': 'ext2',
            'size': 246755328,
            'used': 90145792,
            'use': 36.53,
            'mount': '/boot'
          }
        ],
        'network': [
          {
            'iface': 'lo',
            'ifaceName': 'lo',
            'ip4': '127.0.0.1',
            'ip6': '::1',
            'mac': '',
            'internal': true,
            'virtual': false,
            'operstate': 'unknown',
            'type': 'virtual',
            'duplex': '',
            'mtu': 65536,
            'speed': -1,
            'carrierChanges': 0,
            'stats': {
              'iface': 'lo',
              'operstate': 'unknown',
              'rx_bytes': 251146840,
              'rx_dropped': 0,
              'rx_errors': 0,
              'tx_bytes': 251146840,
              'tx_dropped': 0,
              'tx_errors': 0,
              'rx_sec': 2291.5580473520695,
              'tx_sec': 2288.9690390315322,
              'ms': 56006
            }
          },
          {
            'iface': 'eth0',
            'ifaceName': 'eth0',
            'ip4': '218.108.149.373',
            'ip6': '',
            'mac': '',
            'internal': false,
            'virtual': true,
            'operstate': 'up',
            'type': 'wired',
            'duplex': 'full',
            'mtu': 1500,
            'speed': 1000,
            'carrierChanges': 2,
            'stats': {
              'iface': 'eth0',
              'operstate': 'up',
              'rx_bytes': 1467915636,
              'rx_dropped': 67659,
              'rx_errors': 0,
              'tx_bytes': 923328963,
              'tx_dropped': 67659,
              'tx_errors': 0,
              'rx_sec': 1001.4650182233974,
              'tx_sec': 1443.078682198242,
              'ms': 55972
            }
          }
        ]
      },
      'pm2': [
        {
          'name': 'server-status',
          'pm2_env': {
            'exec_mode': 'fork_mode',
            'status': 'online',
            'watch': true,
            'pm_uptime': 1584190530903,
            'restart_time': 36
          },
          'monit': {
            'memory': 54820864,
            'cpu': 4.4
          },
          'pm_id': 0
        },
        {
          'name': 'fake-status',
          'pm2_env': {
            'exec_mode': 'fork_mode',
            'status': 'online',
            'watch': false,
            'pm_uptime': 1582310694827,
            'restart_time': 0
          },
          'monit': {
            'memory': 17666048,
            'cpu': 2.3
          },
          'pm_id': 1
        },
        {
          'name': 'app-example',
          'pm2_env': {
            'exec_mode': 'fork_mode',
            'status': 'ERRORED',
            'watch': false,
            'pm_uptime': 1582310694827,
            'restart_time': 852
          },
          'monit': {
            'memory': 47666048,
            'cpu': 0.0
          },
          'pm_id': 3
        }
      ],
      'services': [
        {
          'name': 'SSH',
          'port': 22,
          'link': null,
          'hosts': [
            {
              'name': 'localhost',
              'port': 22,
              'open': true
            },
            {
              'name': '218.108.149.373',
              'port': 22,
              'open': true
            }
          ]
        },
        {
          'name': 'Web',
          'port': 80,
          'link': null,
          'hosts': [
            {
              'name': 'localhost',
              'port': 80,
              'open': true
            },
            {
              'name': '218.108.149.373',
              'port': 80,
              'open': true
            }
          ]
        },
        {
          'name': 'Web',
          'port': 443,
          'link': null,
          'hosts': [
            {
              'name': 'localhost',
              'port': 443,
              'open': true
            },
            {
              'name': '218.108.149.373',
              'port': 443,
              'open': true
            }
          ]
        },
        {
          'name': 'MariaDB',
          'port': 3306,
          'link': null,
          'hosts': [
            {
              'name': 'localhost',
              'port': 3306,
              'open': true
            },
            {
              'name': '218.108.149.373',
              'port': 3306,
              'open': false
            }
          ]
        },
        {
          'name': 'Server Status',
          'port': 4000,
          'link': null,
          'hosts': [
            {
              'name': 'localhost',
              'port': 4000,
              'open': true
            },
            {
              'name': '218.108.149.373',
              'port': 4000,
              'open': false
            }
          ]
        },
        {
          'name': 'Caddy',
          'port': 2019,
          'link': null,
          'hosts': [
            {
              'name': 'localhost',
              'port': 2019,
              'open': true
            },
            {
              'name': '218.108.149.373',
              'port': 2019,
              'open': false
            }
          ]
        },
      ],
      'a2': {
        'vhosts': [
          {
            'port': '80',
            'name': '218.108.149.373',
            'statusCode': '200',
            'externalStatusCode': 'IP'
          },
          {
            'port': '443',
            'name': 'example.com',
            'statusCode': '200',
            'externalStatusCode': '200'
          },
          {
            'port': '443',
            'name': 'teapot.example.com',
            'statusCode': '418',
            'externalStatusCode': '418'
          },
          {
            'port': '443',
            'name': 'secret.example.com',
            'statusCode': '401',
            'externalStatusCode': '401'
          },
          {
            'port': '443',
            'name': 'error.example.com',
            'statusCode': '500',
            'externalStatusCode': '500'
          },
          {
            'port': '443',
            'name': 'internal.example.com',
            'statusCode': '200',
            'externalStatusCode': '502'
          }
        ]
      }
    }
  }
}
