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

Run development server:
```bash
$ pnpm dev
```

Run with fake API (for testing without backend):
```bash
$ pnpm fake
```

## License
MIT
