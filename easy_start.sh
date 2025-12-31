#!/bin/bash

set -x

export DEBIAN_FRONTEND=noninteractive

# variables to change
EXTERNAL="" # e.g. "https://status.example.com"
USER="frankenphp" # user that run http server and will run server-status
STATUS_USER="dragon" # username to access server-status
STATUS_PASS="dragon" # password to access server-status
# end variables to change

IP=$(curl -s https://ipinfo.io/ip)
TOKEN=$(openssl rand -hex 32)
ARCH=$(dpkg --print-architecture)

mkdir -p /var/www
cd /var/www/ || exit

# app
sudo mkdir server-status-app
sudo wget https://adam-zielonka.github.io/server-status/server-status-app.tar.gz
sudo tar -zxvf server-status-app.tar.gz -C server-status-app
sudo rm -fr server-status-app.tar.gz

# api
mkdir server-status-api
cd server-status-api || exit
sudo wget "https://adam-zielonka.github.io/server-status/bin/status-linux-$ARCH"
chmod +x "status-linux-$ARCH"

cat > config.jsonc <<- EOM
{
    "listen": {
        "host": "localhost",
        "port": 4000
    },
    "auth": {
        "users": [
            {
                "name": "$STATUS_USER",
                "pass": "$STATUS_PASS"
            }
        ],
        "secret": "$TOKEN"
    },
    "services": [
        {
            "name": "Web",
            "port": "80"
        },
        {
            "name": "Web",
            "port": "443"
        },
        {
            "name": "SSH",
            "port": "22"
        },
        {
            "name": "Server Status",
            "port": "4000"
        },
        {
            "name": "Caddy",
            "port": "2019"
        },
        {
            "name": "MariaDB",
            "port": "3306"
        }
    ],
    "hosts": [
        "localhost",
        "$IP"
    ],
    "external": "$EXTERNAL"
}
EOM

# permissions
chown -R $USER:$USER /var/www

# set service
cat > /etc/systemd/system/status.service <<- EOM
[Unit]
Description=Server Status
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=$USER
Group=$USER
Restart=always
RestartSec=1
ExecStart=/var/www/server-status-api/status-linux-$ARCH --config /var/www/server-status-api/config.jsonc

[Install]
WantedBy=multi-user.target
EOM

systemctl daemon-reload
systemctl enable status.service
systemctl start status.service
