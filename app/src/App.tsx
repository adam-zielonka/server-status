import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Activity, LoaderCircle } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthProvider, useAuth } from '@/features/auth/auth-context'
import { LoginPage } from '@/features/auth/login-page'
import { Dashboard } from '@/features/dashboard/dashboard'

function AuthGate() {
  const { session, checking, validationError, retry, signOut } = useAuth()
  if (checking)
    return (
      <main className="grid min-h-svh place-items-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-5 animate-spin text-primary" />
          Connecting to your server…
        </div>
      </main>
    )
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
  return session ? <Dashboard /> : <LoginPage />
}

export default function App() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { gcTime: 300000 } } }),
  )
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
