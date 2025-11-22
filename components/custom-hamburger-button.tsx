"use client"

import { cn } from "@/lib/utils"

interface CustomHamburgerButtonProps {
  onClick?: () => void
  className?: string
}

export function CustomHamburgerButton({ onClick, className }: CustomHamburgerButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative p-3 rounded-lg transition-all duration-300 ease-in-out",
        "hover:bg-white/20 hover:backdrop-blur-sm hover:scale-110",
        "focus:outline-none focus:ring-2 focus:ring-white/30",
        "active:scale-95 active:bg-white/30",
        "border border-white/10 hover:border-white/30",
        "shadow-lg hover:shadow-xl",
        className
      )}
      aria-label="Open menu"
    >
      <div className="flex flex-col justify-center items-center w-6 h-6 space-y-1.5">
        {/* Top line */}
        <div className={cn(
          "w-6 h-0.5 bg-white rounded-full transition-all duration-300 ease-in-out",
          "group-hover:bg-white group-hover:w-7 group-hover:shadow-sm",
          "group-hover:transform group-hover:translate-y-0.5"
        )} />
        {/* Middle line */}
        <div className={cn(
          "w-6 h-0.5 bg-white rounded-full transition-all duration-300 ease-in-out",
          "group-hover:bg-white group-hover:w-5 group-hover:shadow-sm",
          "group-hover:opacity-80"
        )} />
        {/* Bottom line */}
        <div className={cn(
          "w-6 h-0.5 bg-white rounded-full transition-all duration-300 ease-in-out",
          "group-hover:bg-white group-hover:w-7 group-hover:shadow-sm",
          "group-hover:transform group-hover:-translate-y-0.5"
        )} />
      </div>
      
      {/* Subtle glow effect on hover */}
      <div className={cn(
        "absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300",
        "group-hover:opacity-100 bg-gradient-to-r from-white/5 to-white/10",
        "pointer-events-none"
      )} />
    </button>
  )
}