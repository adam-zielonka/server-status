# Server Status App

Frontend app for the server status API (located in `../api`).

![](./img/server-status.png)

## Build

Default endpoint is '/api/', if you want to use different use env `VITE_API_URL`.
You can use in `.env` file:
```env
VITE_API_URL=https://server.example.com/api/
```
Or you can use in terminal:
```bash
$ VITE_API_URL=https://server.example.com/api/ pnpm build
```

## Development

### With real data

Run development server:
```bash
$ pnpm dev
```

To connect to real backed without port exposing to internet, you can use ssh for that:

```bash
ssh -f -N -M -S /tmp/my-tunnel.sock my-server -L 4000:localhost:4000
```

To end connection

```bash
ssh -S /tmp/my-tunnel.sock -O exit e
```

### With mock data

Run with fake API (for testing without backend):
```bash
$ pnpm fake
```

## License
MIT
