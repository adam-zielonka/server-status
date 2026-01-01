function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const getMockLoadAverage = () => [
  0.76 + Math.floor(Math.random() * 30) / 100,
  0.51 + Math.floor(Math.random() * 24) / 100,
  0.01 + Math.floor(Math.random() * 49) / 100,
]

const getMockMemory = () => ({
  total: 1034330112,
  used: 637571072,
  cached: 106350080,
  free: 290408960,
  swaptotal: 1073737728,
  swapused: 438566912,
  swapfree: 635170816,
})

const getMockSystem = () => ({
  system: {
    distro: 'Debian GNU/Linux',
    release: '10',
    kernel: '4.19.0-8-amd64',
    arch: 'x64',
    hostname: 'example.com',
  },
  cpu: {
    manufacturer: 'Intel®',
    brand: 'Xeon® E5-2650L v4',
    speed: 1.70,
    cores: 1,
  },
  time: {
    uptime: 190131200,
  },
})

const getMockFileSystem = () => [
  {
    fs: '/dev/mapper/vg-lv_root',
    type: 'ext4',
    size: 19755368448,
    used: 4694351872,
    use: 23.76,
    mount: '/',
  },
  {
    fs: '/dev/sda1',
    type: 'ext2',
    size: 246755328,
    used: 90145792,
    use: 36.53,
    mount: '/boot',
  },
]

const getMockNetwork = () => [
  {
    iface: 'lo',
    addresses: ['127.0.0.1', '::1'],
    rx_bytes: 251146840 + Math.floor(Math.random() * 10000),
    tx_bytes: 251146840 + Math.floor(Math.random() * 10000),
  },
  {
    iface: 'eth0',
    addresses: ['218.108.149.373'],
    rx_bytes: 1467915636 + Math.floor(Math.random() * 100000),
    tx_bytes: 923328963 + Math.floor(Math.random() * 100000),
  },
]

const getMockServices = () => [
  {
    name: 'SSH',
    port: '22',
    hosts: [
      { name: 'localhost', port: '22', open: true },
      { name: '218.108.149.373', port: '22', open: true },
    ],
  },
  {
    name: 'Web',
    port: '80',
    hosts: [
      { name: 'localhost', port: '80', open: true },
      { name: '218.108.149.373', port: '80', open: true },
    ],
  },
  {
    name: 'Web',
    port: '443',
    hosts: [
      { name: 'localhost', port: '443', open: true },
      { name: '218.108.149.373', port: '443', open: true },
    ],
  },
  {
    name: 'MariaDB',
    port: '3306',
    hosts: [
      { name: 'localhost', port: '3306', open: true },
      { name: '218.108.149.373', port: '3306', open: false },
    ],
  },
  {
    name: 'Server Status',
    port: '4000',
    hosts: [
      { name: 'localhost', port: '4000', open: true },
      { name: '218.108.149.373', port: '4000', open: false },
    ],
  },
  {
    name: 'Caddy',
    port: '2019',
    hosts: [
      { name: 'localhost', port: '2019', open: true },
      { name: '218.108.149.373', port: '2019', open: false },
    ],
  },
]

const getMockVHosts = () => [
  {
    port: '80',
    name: '218.108.149.373',
    statusCode: '200',
    externalStatusCode: 'IP',
  },
  {
    port: '443',
    name: 'example.com',
    statusCode: '200',
    externalStatusCode: '200',
  },
  {
    port: '443',
    name: 'teapot.example.com',
    statusCode: '418',
    externalStatusCode: '418',
  },
  {
    port: '443',
    name: 'secret.example.com',
    statusCode: '401',
    externalStatusCode: '401',
  },
  {
    port: '443',
    name: 'error.example.com',
    statusCode: '500',
    externalStatusCode: '500',
  },
  {
    port: '443',
    name: 'internal.example.com',
    statusCode: '200',
    externalStatusCode: '502',
  },
]

// Map of endpoints to their mock data generators
const mockEndpoints = {
  'system': getMockSystem,
  'memory': getMockMemory,
  'load-average': getMockLoadAverage,
  'file-system': getMockFileSystem,
  'net': getMockNetwork,
  'services': getMockServices,
  'vhosts': getMockVHosts,
  'auth': () => ({ token: 'fake-token-12345' }),
  'ok': () => 'ok',
}

export async function fakeApi(path = '') {
  await sleep(Math.floor(Math.random() * 10) * 100 + 200)

  const dataGenerator = mockEndpoints[path as keyof typeof mockEndpoints]
  
  if (!dataGenerator) {
    return {
      errors: [`Unknown endpoint: ${path}`]
    }
  }
  
  return {
    data: dataGenerator(),
  }
}
