"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function NewsletterCTA() {
  return (
    <section aria-labelledby="newsletter-title" className="w-full border-t border-border/50">
      <div className="mx-auto max-w-6xl px-6">
        <div className="my-6 md:my-8 rounded-xl bg-muted/60 border border-border/60">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between px-6 py-5 md:px-8 md:py-6">
            <div className="space-y-1">
              <h3 id="newsletter-title" className="text-lg md:text-xl font-semibold text-foreground">
                Stay Ahead of the AI Curve
              </h3>
              <p className="text-sm text-muted-foreground">
                Join our newsletter for exclusive insights and updates on the latest AI trends.
              </p>
            </div>

            <form
              className="w-full md:w-auto"
              onSubmit={(e) => {
                e.preventDefault()
                // TODO: wire up submission
              }}
            >
              <div className="flex items-center gap-2 rounded-full bg-input px-1.5 py-1.5 border border-border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] dark:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)] md:min-w-[380px]">
                <Input
                  type="email"
                  required
                  placeholder="john@email.com"
                  className="bg-transparent border-0 ring-0 focus-visible:ring-0 focus-visible:border-0 placeholder:text-muted-foreground text-sm px-3"
                  aria-label="Email address"
                />
                <Button type="submit" size="sm" className="rounded-full px-4">
                  Submit
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
