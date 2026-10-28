export function AppVersion() {
  return (
    <a
      href={`https://github.com/adam-zielonka/server-status/releases/tag/v${__APP_VERSION__}`}
      target="_blank"
      rel="noreferrer"
      className="hover:text-foreground"
    >
      Server Status v{__APP_VERSION__}
    </a>
  )
}
