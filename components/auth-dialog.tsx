"use client";

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { authService } from "@/lib/auth"

function SocialButtons() {
  const [loading, setLoading] = useState(false)

  const handleGitHubAuth = async () => {
    try {
      setLoading(true)
      const { data, error } = await authService.signInWithGitHub()
      if (error) {
        console.error('GitHub auth error:', error.message)
        alert('GitHub authentication failed. Please try again.')
      } else if (data?.url) {
        // GitHub OAuth returns a URL for redirection
        window.location.href = data.url
      }
    } catch (error) {
      console.error('GitHub auth error:', error)
      alert('GitHub authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <Button 
        type="button" 
        variant="outline" 
        size="default" 
        className="w-full cursor-pointer"
        onClick={handleGitHubAuth}
        disabled={loading}
      >
        <svg className="size-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
        </svg>
        <span>{loading ? 'Connecting...' : 'Continue with GitHub'}</span>
      </Button>
    </div>
  )
}

export default function AuthDialog() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const auth = searchParams?.get("auth")
  const open = Boolean(auth)

  const title = useMemo(() => {
    if (auth === "signup") return "Create an account"
    if (auth === "forgot") return "Forgot Your Password?"
    return "Sign in"
  }, [auth])

  const close = () => {
    const sp = new URLSearchParams(searchParams?.toString() || '')
    sp.delete("auth")
    const q = sp.toString()
    router.replace(q ? `${pathname}?${q}` : pathname || '/')
  }

  useEffect(() => {
    // Close on route change
    return () => {}
  }, [])

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? close() : undefined)}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground mt-1 text-sm">
            {auth === "forgot" 
              ? "Enter your email to receive a reset link"
              : auth === "signup" 
                ? "Create your SmartAPIForge account to start building APIs"
                : "Sign in to your SmartAPIForge account"
            }
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}
          
          {/* Social auth - hidden on forgot view */}
          {auth !== "forgot" && (
            <>
              <SocialButtons />
              <hr className="my-5" />
            </>
          )}

          {auth !== "forgot" && (
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault()
              console.log('Form submitted')
              setLoading(true)
              setError(null)
              
              const formData = new FormData(e.currentTarget)
              const email = formData.get('email') as string
              const password = formData.get('password') as string
              
              console.log('Form data:', { email, password: password ? '***' : 'empty' })
              
              try {
                if (auth === 'signup') {
                  const { data, error } = await authService.signUp(email, password)
                  if (error) throw error
                  alert('Check your email for verification link!')
                  close() // Close dialog after signup
                } else {
                  console.log('Attempting Supabase sign in...')
                  const { data, error } = await authService.signIn(email, password)
                  console.log('Supabase response:', { data: !!data, error: error?.message })
                  
                  if (error) {
                    throw error
                  }
                  
                  if (data?.user) {
                    console.log('Sign in successful, setting auth data...')
                    
                    // Supabase automatically handles session storage
                    // Set cookies for server-side access
                    if (data.session) {
                      const { setAuthCookies } = await import('../lib/auth-handler')
                      setAuthCookies(data.session)
                    }
                    
                    localStorage.setItem("user", JSON.stringify({
                      name: data.user.email?.split('@')[0] || 'User',
                      email: data.user.email || email
                    }))
                    
                    console.log('Auth data set, redirecting to dashboard...')
                    
                    // Close dialog first, then redirect
                    close()
                    
                    // Use window.location for a hard redirect to ensure it works
                    setTimeout(() => {
                      window.location.href = '/ask'
                    }, 100)
                  } else {
                    throw new Error('Sign in failed - no user data received')
                  }
                }
              } catch (error: any) {
                setError(error.message || 'Authentication failed')
              } finally {
                setLoading(false)
              }
            }}>
              <div className="space-y-2">
                <Label htmlFor="email" className="block text-sm">Email</Label>
                <Input id="email" name="email" type="email" required className="ring-foreground/15 border-transparent ring-1" placeholder="Your email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="block text-sm">Password</Label>
                <Input id="password" name="password" type="password" required minLength={6} className="ring-foreground/15 border-transparent ring-1" placeholder={auth === "signup" ? "Create password" : "Enter password"} />
              </div>
              <Button 
                type="submit" 
                className="w-full cursor-pointer"
                disabled={loading}
              >
                {loading ? 'Loading...' : (auth === "signup" ? "Create Account" : "Sign In")}
              </Button>
              <div className="text-right">
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-sm cursor-pointer"
                  onClick={() => router.replace("/?auth=forgot")}
                >
                  Forgot password?
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">
                {auth === "signup" ? (
                  <>Already have an account? <Button type="button" variant="link" className="px-1 cursor-pointer" onClick={() => router.replace("/?auth=login")}>Sign In</Button></>
                ) : (
                  <>Don't have an account? <Button type="button" variant="link" className="px-1 cursor-pointer" onClick={() => router.replace("/?auth=signup")}>Create account</Button></>
                )}
              </p>
            </form>
          )}

          {auth === "forgot" && (
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault()
              setLoading(true)
              setError(null)
              
              const formData = new FormData(e.currentTarget)
              const email = formData.get('email') as string
              
              try {
                const { error } = await authService.resetPassword(email)
                if (error) throw error
                alert('Password reset link sent to your email!')
                router.replace("/?auth=login")
              } catch (error: any) {
                setError(error.message || 'Failed to send reset email')
              } finally {
                setLoading(false)
              }
            }}>
              <div className="space-y-2">
                <Label htmlFor="f-email" className="block text-sm">Email</Label>
                <Input id="f-email" name="email" type="email" required className="ring-foreground/15 border-transparent ring-1" placeholder="Your email" />
              </div>
              <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <p className="text-muted-foreground text-sm">
                Remember your password? <Button type="button" variant="link" className="px-1 cursor-pointer" onClick={() => router.replace("/?auth=login")}>Sign In</Button>
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
