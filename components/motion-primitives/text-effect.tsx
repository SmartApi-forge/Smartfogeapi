"use client"
import React from "react"
import { motion } from "framer-motion"
import type { JSX } from "react/jsx-runtime" // Import JSX to fix the undeclared variable error

interface TextEffectProps {
  children: React.ReactNode
  className?: string
  preset?: "fade-in-blur"
  speedSegment?: number
  delay?: number
  as?: keyof JSX.IntrinsicElements
  per?: "line" | "word" | "char"
}

export const TextEffect: React.FC<TextEffectProps> = ({
  children,
  className,
  preset = "fade-in-blur",
  speedSegment = 0.3,
  delay = 0,
  as: Component = "div",
  per = "word",
}) => {
  const text = typeof children === "string" ? children : ""

  const variants = {
    hidden: { opacity: 0, filter: "blur(12px)", y: 12 },
    visible: { opacity: 1, filter: "blur(0px)", y: 0 },
  }

  if (per === "line") {
    const lines = text.split("\n")
    return (
      <Component className={className}>
        {lines.map((line, i) => (
          <motion.div
            key={i}
            initial="hidden"
            animate="visible"
            variants={variants}
            transition={{
              duration: speedSegment,
              delay: delay + i * 0.1,
              ease: "easeOut",
            }}
          >
            {line}
          </motion.div>
        ))}
      </Component>
    )
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={{
        duration: speedSegment,
        delay,
        ease: "easeOut",
      }}
    >
      {Component === "div" ? children : React.createElement(Component, {}, children)}
    </motion.div>
  )
}
