"use client"

import React, { useState, useEffect } from "react"

interface TypingAnimationProps {
  prompts: string[]
  className?: string
  typingSpeed?: number
  deletingSpeed?: number
  pauseAfterType?: number
  pauseAfterDelete?: number
}

export const TypingAnimation: React.FC<TypingAnimationProps> = ({
  prompts,
  className = "",
  typingSpeed = 50,
  deletingSpeed = 30,
  pauseAfterType = 2000,
  pauseAfterDelete = 500,
}) => {
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const [currentText, setCurrentText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    const currentPrompt = prompts[currentPromptIndex]
    
    if (isPaused) {
      const pauseTimeout = setTimeout(() => {
        setIsPaused(false)
        if (isDeleting) {
          setIsDeleting(false)
          setCurrentPromptIndex((prev) => (prev + 1) % prompts.length)
        } else {
          setIsDeleting(true)
        }
      }, isDeleting ? pauseAfterDelete : pauseAfterType)
      
      return () => clearTimeout(pauseTimeout)
    }

    const timeout = setTimeout(() => {
      if (isDeleting) {
        if (currentText.length > 0) {
          setCurrentText(currentPrompt.substring(0, currentText.length - 1))
        } else {
          setIsPaused(true)
        }
      } else {
        if (currentText.length < currentPrompt.length) {
          setCurrentText(currentPrompt.substring(0, currentText.length + 1))
        } else {
          setIsPaused(true)
        }
      }
    }, isDeleting ? deletingSpeed : typingSpeed)

    return () => clearTimeout(timeout)
  }, [
    currentText,
    currentPromptIndex,
    isDeleting,
    isPaused,
    prompts,
    typingSpeed,
    deletingSpeed,
    pauseAfterType,
    pauseAfterDelete,
  ])

  return (
    <span className={className}>
      {currentText}
      <span className="animate-pulse">|</span>
    </span>
  )
}
