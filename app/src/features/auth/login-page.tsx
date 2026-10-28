import { useState, type FormEvent } from 'react'
import { Activity, ArrowRight, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useAuth } from './auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isDemo } from '@/lib/api'
import { AppVersion } from '@/components/app-version'

export function LoginPage() {
  const { signIn, signingIn, error } = useAuth()
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await signIn(user, password)
    setPassword('')
  }
  return (
    <main className="grid min-h-svh place-items-center px-5 py-12">
      <div className="w-full max-w-[390px]">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Server Status</span>
        </div>
        <Card className="gap-5 shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your infrastructure dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              {error && (
                <p
                  role="alert"
                  className="rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  required
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  disabled={signingIn}
                  placeholder="Your username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={signingIn}
                  placeholder="Enter your password"
                />
              </div>
              <Button
                className="w-full"
                type="submit"
                disabled={signingIn || !user.trim() || !password}
              >
                {signingIn ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />}
                {signingIn ? 'Signing in…' : 'Sign in'}
                {!signingIn && <ArrowRight className="ml-auto" />}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          {isDemo ? 'Demo mode · Synthetic data only' : 'Authenticated access to your server'}
        </p>
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          <AppVersion />
        </p>
      </div>
    </main>
  )
}
