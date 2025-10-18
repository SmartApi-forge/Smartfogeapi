"use client";

import { motion } from "framer-motion";
import { Clock, Code, Database, Brain } from "lucide-react";
import { useEffect } from "react";

interface LoadingAnimationProps {
  onComplete?: () => void;
}

export function LoadingAnimation({ onComplete }: LoadingAnimationProps) {
  useEffect(() => {
    // Redirect after 2 seconds for a quick loading experience
    const timer = setTimeout(() => {
      onComplete?.();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        {/* SmartAPIForge logo placeholder */}
        <div className="mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-6 h-6 bg-purple-500 rounded-full mr-2"></div>
            <span className="text-white text-lg font-medium">
              SmartAPIForge
            </span>
          </div>
        </div>

        {/* Icon row with spinning animation */}
        <div className="flex items-center justify-center space-x-6 mb-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-gray-400"
          >
            <Clock className="w-8 h-8" />
          </motion.div>

          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
              delay: 0.2,
            }}
            className="text-green-400"
          >
            <Code className="w-8 h-8" />
          </motion.div>

          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
              delay: 0.4,
            }}
            className="text-orange-400"
          >
            <Database className="w-8 h-8" />
          </motion.div>

          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
              delay: 0.6,
            }}
            className="text-yellow-400"
          >
            <Brain className="w-8 h-8" />
          </motion.div>
        </div>

        {/* Simple text */}
        <p className="text-gray-400 text-sm">Spinning up your project</p>
      </div>
    </div>
  );
}

export default LoadingAnimation;
