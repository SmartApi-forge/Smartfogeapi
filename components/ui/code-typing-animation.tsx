"use client"

import React, { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface CodeLine {
  text: string
  className?: string
}

interface CodeTypingAnimationProps {
  codeLines: CodeLine[]
  className?: string
  typingSpeed?: number
  pauseBetweenLines?: number
  showCursor?: boolean
}

export const CodeTypingAnimation: React.FC<CodeTypingAnimationProps> = ({
  codeLines,
  className = "",
  typingSpeed = 50,
  pauseBetweenLines = 100,
  showCursor = true,
}) => {
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [currentText, setCurrentText] = useState("")
  const [displayedLines, setDisplayedLines] = useState<CodeLine[]>([])
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (currentLineIndex >= codeLines.length) {
      setIsComplete(true)
      return
    }

    const currentLine = codeLines[currentLineIndex]
    const targetText = currentLine.text

    if (currentText.length < targetText.length) {
      const timeout = setTimeout(() => {
        setCurrentText(targetText.substring(0, currentText.length + 1))
      }, typingSpeed)
      return () => clearTimeout(timeout)
    } else {
      // Line is complete, add it to displayed lines and move to next
      const timeout = setTimeout(() => {
        setDisplayedLines(prev => [...prev, { ...currentLine, text: currentText }])
        setCurrentText("")
        setCurrentLineIndex(prev => prev + 1)
      }, pauseBetweenLines)
      return () => clearTimeout(timeout)
    }
  }, [currentText, currentLineIndex, codeLines, typingSpeed, pauseBetweenLines])

  // Reset animation when codeLines change
  useEffect(() => {
    setCurrentLineIndex(0)
    setCurrentText("")
    setDisplayedLines([])
    setIsComplete(false)
  }, [codeLines])

  return (
    <div className={cn("font-mono text-sm", className)}>
      {displayedLines.map((line, index) => (
        <div key={index} className={cn("whitespace-pre", line.className)}>
          {line.text}
        </div>
      ))}
      {!isComplete && currentLineIndex < codeLines.length && (
        <div className={cn("whitespace-pre", codeLines[currentLineIndex]?.className)}>
          {currentText}
          {showCursor && (
            <span className="animate-pulse text-blue-500">|</span>
          )}
        </div>
      )}
    </div>
  )
}