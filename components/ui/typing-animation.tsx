"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface TypingAnimationProps {
  text: string
  duration?: number
  className?: string
  onComplete?: () => void
}

export function TypingAnimation({ 
  text, 
  duration = 50, 
  className,
  onComplete 
}: TypingAnimationProps) {
  const [displayText, setDisplayText] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const hasCompletedRef = useRef(false)

  // Reset when the text changes (new line)
  useEffect(() => {
    setDisplayText("")
    setCurrentIndex(0)
    hasCompletedRef.current = false
  }, [text])

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, duration)

      return () => clearTimeout(timeout)
    } else if (onComplete && !hasCompletedRef.current) {
      hasCompletedRef.current = true
      onComplete()
    }
  }, [currentIndex, duration, text, onComplete])

  return (
    <span className={cn("", className)}>
      {displayText}
      {currentIndex < text.length && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  )
}

interface CodeTypingAnimationProps {
  lines: { text: string; className?: string }[]
  lineDelay?: number
  charDelay?: number
  className?: string
  startDelay?: number
  loop?: boolean
  loopDelay?: number
}

export function CodeTypingAnimation({ 
  lines, 
  lineDelay = 800, 
  charDelay = 30,
  className,
  startDelay = 0,
  loop = false,
  loopDelay = 1200,
}: CodeTypingAnimationProps) {
  const [started, setStarted] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [cycle, setCycle] = useState(0)

  const fullText = lines.map(l => l.text).join("\n")

  useEffect(() => {
    if (startDelay > 0) {
      const t = setTimeout(() => setStarted(true), startDelay)
      return () => clearTimeout(t)
    }
    setStarted(true)
  }, [startDelay])

  // When complete and looping enabled, restart after a delay
  useEffect(() => {
    if (!loop) return
    if (!isComplete) return
    const t = setTimeout(() => {
      setIsComplete(false)
      // retrigger TypingAnimation by changing key
      setCycle((c) => c + 1)
      // optionally retrigger start-guard
      if (startDelay > 0) {
        setStarted(false)
        const st = setTimeout(() => setStarted(true), startDelay)
        return () => clearTimeout(st)
      }
    }, loopDelay)
    return () => clearTimeout(t)
  }, [isComplete, loop, loopDelay, startDelay])

  if (!started) {
    return (
      <div className={cn("font-mono text-sm", className)}>
        <span className="animate-pulse">|</span>
      </div>
    )
  }

  return (
    <div className={cn("font-mono text-sm", className)}>
      {!isComplete ? (
        <div className={"whitespace-pre"}>
          <TypingAnimation
            text={fullText}
            duration={charDelay}
            onComplete={() => setIsComplete(true)}
            key={cycle}
          />
        </div>
      ) : (
        <div className="whitespace-pre">
          {lines.map((line, idx) => (
            <div key={idx} className={cn("whitespace-pre", line.className)}>
              {line.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
