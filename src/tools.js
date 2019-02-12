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
        host: 'localhost',
        port: 4000,
        cross_origin: true
    },
    HOSTS: [
        `localhost`,
    ]
    
}

export function getConfig() {
    try {
        return {...DEFAULT_CONFIG, ...require('./config')}
    } catch (e) {
        return DEFAULT_CONFIG
    }
}