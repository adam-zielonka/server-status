import * as util from 'util'
export const exec = util.promisify(require('child_process').exec)

const DEFAULT_CONFIG = {
    USERS: [
        {
            name: 'pancake',
            pass: 'pancake',
        }
    ],
    APP_SECRET: 'pancake-is-the-best-dragon',
    SERVICES: [],
    VHOST: {},
    WEB: {
        localhost: false,
        port: 4000,
    },
    HOSTS: [
        `localhost`,
    ]
    
}

let CONFIG = null

export function getConfig() {
    if (CONFIG) return CONFIG
    try {
        return {...DEFAULT_CONFIG, ...require('./config')}
    } catch (e) {
        return DEFAULT_CONFIG
    }
}

export function setConfig(config) {
    CONFIG = {...DEFAULT_CONFIG, ...config}
    return CONFIG
}
