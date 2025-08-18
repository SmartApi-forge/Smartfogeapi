import React from "react"
import { motion } from "framer-motion"

export default function BelowFooterBanner() {
  return (
    <motion.section
      aria-label="brand banner"
      className="relative bg-background overflow-hidden hidden sm:block"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      viewport={{ once: true, amount: 0.3 }}
    >
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:pt-12 md:pt-16 pb-2 sm:pb-3 md:pb-4">
        <motion.div 
          className="relative grid place-items-center"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.5 }}
        >
          {/* Subtle radial vignette to mimic screenshot depth */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              maskImage:
                "radial-gradient(120% 80% at 50% 50%, black 55%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(120% 80% at 50% 50%, black 55%, transparent 100%)",
            }}
          />

          {/* Soft glowing gradient blobs (like screenshot) */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 h-[340px] w-[720px] blur-[80px] opacity-60"
            style={{
              background:
                "radial-gradient(40% 60% at 40% 60%, rgba(34, 197, 94, 0.12), transparent 70%), radial-gradient(40% 60% at 65% 45%, rgba(250, 204, 21, 0.10), transparent 70%)",
            }}
          />
          {/* Bottom counter glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 h-[220px] w-[640px] blur-[80px] opacity-40"
            style={{
              background:
                "radial-gradient(45% 55% at 50% 0%, rgba(132, 204, 22, 0.08), transparent 70%)",
            }}
          />

          {/* Huge, low-contrast wordmark like screenshot */}
          <motion.div 
            className="relative"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
            viewport={{ once: true, amount: 0.8 }}
          >
            <h2
              className="select-none text-center font-semibold tracking-tight text-foreground/8 dark:text-white/8
                         text-[56px] sm:text-[88px] md:text-[112px] lg:text-[136px] leading-none"
            >
              SMART API FORGE
            </h2>
            {/* Gradient text overlay for a faint color sheen */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <span
                className="select-none bg-gradient-to-r from-green-400/15 via-yellow-400/15 to-transparent bg-clip-text text-transparent
                               font-semibold tracking-tight text-center
                               text-[56px] sm:text-[88px] md:text-[112px] lg:text-[136px] leading-none"
              >
                SMART API FORGE
              </span>
            </div>
            {/* Subtle noise overlay for texture */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.02] mix-blend-overlay"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0, rgba(255,255,255,0.4) 1px, transparent 1px, transparent 2px)",
              }}
            />
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  )
}
