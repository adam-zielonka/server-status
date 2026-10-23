import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Activity, LoaderCircle } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthProvider, useAuth } from '@/features/auth/auth-context'
import { LoginPage } from '@/features/auth/login-page'

const Dashboard = lazy(() =>
  import('@/features/dashboard/dashboard').then(({ Dashboard }) => ({ default: Dashboard })),
)

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="grid min-h-svh place-items-center p-5">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle role="heading" aria-level={1}>
              Could not load the dashboard
            </CardTitle>
            <CardDescription>
              The dashboard could not be loaded. Reload the page to try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>Reload page</Button>
          </CardContent>
        </Card>
      </main>
    )
  }
}

function Connecting() {
  return (
    <main className="grid min-h-svh place-items-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
        <LoaderCircle className="size-5 animate-spin text-primary" />
        Connecting to your server…
      </div>
    </main>
  )
}

function AuthGate() {
  const { session, checking, validationError, retry, signOut } = useAuth()
  if (checking) return <Connecting />
  if (validationError && session)
    return (
      <main className="grid min-h-svh place-items-center p-5">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Activity className="mb-3 size-6 text-primary" />
            <CardTitle>Could not connect</CardTitle>
            <CardDescription role="alert">{validationError}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={retry}>Try again</Button>
            <Button variant="outline" onClick={() => signOut()}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  return session ? (
    <Suspense fallback={<Connecting />}>
      <Dashboard />
    </Suspense>
  ) : (
    <LoginPage />
  )
}

export default function App() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { gcTime: 300000 } } }),
  )
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  )
}
