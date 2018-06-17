export const Config = {
    modules: {
        system: true,
        fs: true,
        network: true,
        loadAverage: true,
        memory: true,
        cpu: true,
        pm2: true,
        vhost: true,
        services: true
    },
    headers: new Headers({
        'Authorization': 'Basic '+btoa('user:password'), 
        'Content-Type': 'application/x-www-form-urlencoded'
    })
}