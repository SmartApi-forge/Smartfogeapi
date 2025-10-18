"use client";

import React from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
  status: "pending" | "in-progress" | "complete" | "error";
}

interface GenerationProgressTrackerProps {
  currentStep?: string;
  status:
    | "idle"
    | "initializing"
    | "generating"
    | "validating"
    | "complete"
    | "error";
}

/**
 * Visual progress tracker showing the current stage of API generation
 * Displays: Planning → Generating → Validating → Complete
 */
export function GenerationProgressTracker({
  currentStep,
  status,
}: GenerationProgressTrackerProps) {
  const steps: Step[] = [
    {
      id: "planning",
      label: "Planning API",
      status: getStepStatus("planning", status),
    },
    {
      id: "generating",
      label: "Generating Code",
      status: getStepStatus("generating", status),
    },
    {
      id: "validating",
      label: "Validating",
      status: getStepStatus("validating", status),
    },
    {
      id: "complete",
      label: "Complete",
      status: getStepStatus("complete", status),
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto py-8">
      <div className="relative">
        {/* Progress bar background */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-secondary" />

        {/* Active progress bar */}
        <motion.div
          className="absolute top-5 left-0 h-0.5 bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: `${getProgressPercentage(status)}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center">
              {/* Step circle */}
              <motion.div
                className={cn(
                  "w-10 h-10 rounded-full border-2 flex items-center justify-center bg-background",
                  step.status === "complete" &&
                    "border-primary bg-primary text-primary-foreground",
                  step.status === "in-progress" && "border-primary",
                  step.status === "pending" && "border-secondary",
                  step.status === "error" &&
                    "border-destructive bg-destructive text-destructive-foreground",
                )}
                initial={{ scale: 0.8 }}
                animate={{
                  scale: step.status === "in-progress" ? [0.9, 1.1, 0.9] : 1,
                }}
                transition={{
                  duration: 1.5,
                  repeat: step.status === "in-progress" ? Infinity : 0,
                }}
              >
                {step.status === "complete" && <Check className="h-5 w-5" />}
                {step.status === "in-progress" && (
                  <Loader2 className="h-5 w-5 animate-spin" />
                )}
                {step.status === "pending" && <Circle className="h-5 w-5" />}
                {step.status === "error" && <span>✕</span>}
              </motion.div>

              {/* Step label */}
              <div className="mt-2 text-center">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.status === "in-progress" && "text-primary",
                    step.status === "complete" && "text-foreground",
                    step.status === "pending" && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>

                {/* Show sub-step for in-progress */}
                {step.status === "in-progress" && currentStep && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-muted-foreground mt-1"
                  >
                    {currentStep}
                  </motion.p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Determine the status of each step based on overall generation status
 */
function getStepStatus(
  stepId: string,
  overallStatus: GenerationProgressTrackerProps["status"],
): Step["status"] {
  const stepOrder = ["planning", "generating", "validating", "complete"];
  const currentIndex = stepOrder.indexOf(
    overallStatus === "initializing" ? "planning" : overallStatus,
  );
  const stepIndex = stepOrder.indexOf(stepId);

  if (overallStatus === "error") {
    return stepIndex <= currentIndex ? "error" : "pending";
  }

  if (stepIndex < currentIndex) {
    return "complete";
  } else if (stepIndex === currentIndex) {
    return "in-progress";
  } else {
    return "pending";
  }
}

/**
 * Calculate progress percentage based on status
 */
function getProgressPercentage(
  status: GenerationProgressTrackerProps["status"],
): number {
  switch (status) {
    case "idle":
      return 0;
    case "initializing":
      return 10;
    case "generating":
      return 50;
    case "validating":
      return 80;
    case "complete":
      return 100;
    case "error":
      return 100;
    default:
      return 0;
  }
}
