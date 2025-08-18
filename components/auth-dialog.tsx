"use client";

import { useEffect, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

function SocialButtons() {
  return (
    <div className="mt-2 space-y-2">
      <Button type="button" variant="outline" size="default" className="w-full">
        <svg fill="currentColor" fillRule="evenodd" style={{flex:"none",lineHeight:1}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg" className="size-4">
          <title>Anthropic</title>
          <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z"/>
        </svg>
        <span>Anthropic</span>
      </Button>
      <Button type="button" variant="outline" size="default" className="w-full">
        <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid" viewBox="0 0 256 233" className="size-4">
          <path d="M186.18182 0h46.54545v46.54545h-46.54545z"/>
          <path fill="#F7D046" d="M209.45454 0h46.54545v46.54545h-46.54545z"/>
          <path d="M0 0h46.54545v46.54545H0zM0 46.54545h46.54545V93.0909H0zM0 93.09091h46.54545v46.54545H0zM0 139.63636h46.54545v46.54545H0zM0 186.18182h46.54545v46.54545H0z"/>
          <path fill="#F7D046" d="M23.27273 0h46.54545v46.54545H23.27273z"/>
          <path fill="#F2A73B" d="M209.45454 46.54545h46.54545V93.0909h-46.54545zM23.27273 46.54545h46.54545V93.0909H23.27273z"/>
          <path d="M139.63636 46.54545h46.54545V93.0909h-46.54545z"/>
          <path fill="#F2A73B" d="M162.90909 46.54545h46.54545V93.0909h-46.54545zM69.81818 46.54545h46.54545V93.0909H69.81818z"/>
          <path fill="#EE792F" d="M116.36364 93.09091h46.54545v46.54545h-46.54545zM162.90909 93.09091h46.54545v46.54545h-46.54545zM69.81818 93.09091h46.54545v46.54545H69.81818z"/>
          <path d="M93.09091 139.63636h46.54545v46.54545H93.09091z"/>
          <path fill="#EB5829" d="M116.36364 139.63636h46.54545v46.54545h-46.54545z"/>
          <path fill="#EE792F" d="M209.45454 93.09091h46.54545v46.54545h-46.54545zM23.27273 93.09091h46.54545v46.54545H23.27273z"/>
          <path d="M186.18182 139.63636h46.54545v46.54545h-46.54545z"/>
          <path fill="#EB5829" d="M209.45454 139.63636h46.54545v46.54545h-46.54545z"/>
          <path d="M186.18182 186.18182h46.54545v46.54545h-46.54545z"/>
          <path fill="#EB5829" d="M23.27273 139.63636h46.54545v46.54545H23.27273z"/>
          <path fill="#EA3326" d="M209.45454 186.18182h46.54545v46.54545h-46.54545zM23.27273 186.18182h46.54545v46.54545H23.27273z"/>
        </svg>
        <span>Mistral</span>
      </Button>
      <Button type="button" variant="outline" size="default" className="w-full">
        <svg width="95" height="88" viewBox="0 0 95 88" version="1.1" xmlns="http://www.w3.org/2000/svg" className="size-4">
          <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
            <g>
              <path d="M93.7930402,70.08 C94.5430402,72.24 94.3630402,74.54 93.3630402,76.54 C92.6430402,78 91.6130402,79.13 90.3530402,80.14 C88.8330402,81.34 86.9430402,82.36 84.6630402,83.34 C81.9430402,84.5 78.6230402,85.59 77.1030402,85.99 C73.2130402,87 69.4730402,87.64 65.6830402,87.67 C60.2630402,87.72 55.5930402,86.44 52.2730402,83.17 C50.5530402,83.38 48.8130402,83.5 47.0630402,83.5 C45.4030402,83.5 43.7630402,83.4 42.1330402,83.2 C38.8030402,86.45 34.1530402,87.72 28.7530402,87.67 C24.9630402,87.64 21.2230402,87 17.3230402,85.99 C15.8130402,85.59 12.4930402,84.5 9.77304019,83.34 C7.49304019,82.36 5.60304019,81.34 4.09304019,80.14 C2.82304019,79.13 1.79304019,78 1.07304019,76.54 C0.0830401858,74.54 -0.106959814,72.24 0.653040186,70.08 C-0.0469598142,68.43 -0.226959814,66.54 0.323040186,64.45 C0.573040186,63.5 0.983040186,62.62 1.50304019,61.84 C1.39304019,61.43 1.30304019,61.01 1.24304019,60.55 C0.863040186,57.81 1.81304019,55.31 3.60304019,53.37 C4.48304019,52.4 5.43304019,51.73 6.42304019,51.3 C5.69304019,48.2 5.31304019,45.01 5.31304019,41.75 C5.31304019,18.69 24.0030402,0 47.0630402,0 C54.9830402,0 62.3930402,2.2 68.7130402,6.04 C69.8530402,6.74 70.9730402,7.49 72.0430402,8.29 C72.5730402,8.69 73.1030402,9.1 73.6130402,9.53 C74.1330402,9.95 74.6430402,10.39 75.1330402,10.84 C76.6130402,12.19 78.0030402,13.64 79.2730402,15.19 C79.7030402,15.7 80.1130402,16.23 80.5130402,16.77 C81.3230402,17.84 82.0730402,18.95 82.7630402,20.1 C83.8130402,21.82 84.7330402,23.62 85.5330402,25.49 C86.0630402,26.74 86.5230402,28.02 86.9330402,29.33 C87.5430402,31.29 88.0130402,33.31 88.3330402,35.39 C88.4330402,36.08 88.5230402,36.78 88.5930402,37.48 C88.7330402,38.88 88.8130402,40.3 88.8130402,41.75 C88.8130402,44.97 88.4330402,48.13 87.7230402,51.18 C88.8230402,51.61 89.8630402,52.31 90.8330402,53.37 C92.6230402,55.31 93.5730402,57.82 93.1930402,60.56 C93.1330402,61.01 93.0430402,61.43 92.9330402,61.84 C93.4530402,62.62 93.8630402,63.5 94.1130402,64.45 C94.6630402,66.54 94.4830402,68.43 93.7930402,70.08 Z" fill="#FF9A0E" fillRule="nonzero"/>
              <circle fill="#FFD21E" fillRule="nonzero" cx="46.75" cy="41.75" r="34.75"/>
              <path d="M81.5,41.75 C81.5,22.5581049 65.9418951,7 46.75,7 C27.5581049,7 12,22.5581049 12,41.75 C12,60.9418951 27.5581049,76.5 46.75,76.5 C65.9418951,76.5 81.5,60.9418951 81.5,41.75 Z M8,41.75 C8,20.3489659 25.3489659,3 46.75,3 C68.1510341,3 85.5,20.3489659 85.5,41.75 C85.5,63.1510341 68.1510341,80.5 46.75,80.5 C25.3489659,80.5 8,63.1510341 8,41.75 Z" fill="#FFAC03" fillRule="nonzero"/>
            </g>
          </g>
        </svg>
        <span>Hugging Face</span>
      </Button>
      <Button type="button" variant="outline" size="default" className="w-full">
        <svg xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" viewBox="0 0 75 75" className="size-4">
          <path d="M24.3 44.7c2 0 6-.1 11.6-2.4 6.5-2.7 19.3-7.5 28.6-12.5 6.5-3.5 9.3-8.1 9.3-14.3C73.8 7 66.9 0 58.3 0h-36C10 0 0 10 0 22.3s9.4 22.4 24.3 22.4z" style={{fillRule:"evenodd",clipRule:"evenodd",fill:"#39594d"}}/>
          <path d="M30.4 60c0-6 3.6-11.5 9.2-13.8l11.3-4.7C62.4 36.8 75 45.2 75 57.6 75 67.2 67.2 75 57.6 75H45.3c-8.2 0-14.9-6.7-14.9-15z" style={{fillRule:"evenodd",clipRule:"evenodd",fill:"#d18ee2"}}/>
          <path d="M12.9 47.6C5.8 47.6 0 53.4 0 60.5v1.7C0 69.2 5.8 75 12.9 75c7.1 0 12.9-5.8 12.9-12.9v-1.7c-.1-7-5.8-12.8-12.9-12.8z" style={{fill:"#ff7759"}}/>
        </svg>
        <span>Cohere</span>
      </Button>
    </div>
  )
}

export default function AuthDialog() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const auth = searchParams.get("auth")
  const open = Boolean(auth)

  const title = useMemo(() => {
    if (auth === "signup") return "Create an account"
    if (auth === "forgot") return "Forgot Your Password?"
    return "Sign in"
  }, [auth])

  const close = () => {
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete("auth")
    const q = sp.toString()
    router.replace(q ? `${pathname}?${q}` : pathname)
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
          {auth === "forgot" && (
            <p className="text-muted-foreground mt-1 text-sm">Enter your email to receive a reset link</p>
          )}
        </DialogHeader>
        <div className="px-6 pb-6">
          {/* Social auth - hidden on forgot view */}
          {auth !== "forgot" && (
            <>
              <SocialButtons />
              <hr className="my-5" />
            </>
          )}

          {auth !== "forgot" && (
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
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
                className="w-full"
                onClick={(e) => {
                  e.preventDefault()
                  // Mock authentication - in real app, this would call your auth API
                  localStorage.setItem("authToken", "mock-token-" + Date.now())
                  localStorage.setItem("user", JSON.stringify({
                    name: "John Doe",
                    email: "john@example.com"
                  }))
                  router.push("/dashboard")
                }}
              >
                Continue
              </Button>
              <div className="text-right">
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-sm"
                  onClick={() => router.replace("/?auth=forgot")}
                >
                  Forgot password?
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">
                {auth === "signup" ? (
                  <>Already have an account? <Button type="button" variant="link" className="px-1" onClick={() => router.replace("/?auth=login")}>Sign In</Button></>
                ) : (
                  <>Don't have an account? <Button type="button" variant="link" className="px-1" onClick={() => router.replace("/?auth=signup")}>Create account</Button></>
                )}
              </p>
            </form>
          )}

          {auth === "forgot" && (
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <Label htmlFor="f-email" className="block text-sm">Email</Label>
                <Input id="f-email" name="email" type="email" required className="ring-foreground/15 border-transparent ring-1" placeholder="Your email" />
              </div>
              <Button type="submit" className="w-full">Send Reset Link</Button>
              <p className="text-muted-foreground text-sm">
                You remember your password ? <Button type="button" variant="link" className="px-1" onClick={() => router.replace("/?auth=login")}>Sign In</Button>
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
