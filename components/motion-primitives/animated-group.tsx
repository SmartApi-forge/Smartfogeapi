"use client"
import type React from "react"
import { motion } from "@/components/motion-wrapper"

interface AnimatedGroupProps {
  children: React.ReactNode
  className?: string
  variants?: any
}

export const AnimatedGroup: React.FC<AnimatedGroupProps> = ({ children, className, variants }) => {
  return (
    <motion.div className={className} initial="hidden" animate="visible" variants={variants}>
      {children}
    </motion.div>
  )
}
