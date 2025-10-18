"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  AnimationStart,
  AnimationVariant,
  createAnimation,
} from "@/components/theme/theme-animations";

interface ThemeSwitchProps extends React.HTMLAttributes<HTMLDivElement> {
  modes?: string[];
  icons?: React.ReactNode[];
  showActiveIconOnly?: boolean;
  showInactiveIcons?: "all" | "none" | "next";
  variant?: "default" | "icon-click" | "circle-blur";
  start?: AnimationStart;
  hideAnimations?: boolean;
  animationVariant?: AnimationVariant;
}

const ThemeSwitch = React.forwardRef<HTMLDivElement, ThemeSwitchProps>(
  (
    {
      className,
      modes = ["light", "dark", "system"],
      icons = [],
      showActiveIconOnly = false,
      showInactiveIcons = "all",
      variant = "default",
      start = "bottom-left",
      hideAnimations = false,
      animationVariant = "circle-blur",
      ...props
    },
    ref,
  ) => {
    const { theme, setTheme } = useTheme();
    const [isAnimating, setIsAnimating] = React.useState(false);

    const styleId = "theme-transition-styles";

    const updateStyles = React.useCallback((css: string, name: string) => {
      if (typeof window === "undefined") return;

      let styleElement = document.getElementById(styleId) as HTMLStyleElement;

      if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }

      styleElement.textContent = css;
    }, []);

    const currentModeIndex = React.useMemo(() => {
      const index = modes.indexOf(theme || "");
      return index !== -1 ? index : 0;
    }, [theme, modes]);

    const handleToggle = React.useCallback(() => {
      if (variant === "circle-blur") {
        const animation = createAnimation(animationVariant, start);
        updateStyles(animation.css, animation.name);

        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 800);
      }

      const nextIndex = (currentModeIndex + 1) % modes.length;

      const switchTheme = () => {
        setTheme(modes[nextIndex]);
      };

      // Check if there are any active EventSource connections (streaming in progress)
      // Skip view transition during streaming to prevent DOM update blocking
      const hasActiveStreaming =
        typeof window !== "undefined" &&
        (window as any).__activeStreamingSessions > 0;

      if (
        variant === "circle-blur" &&
        typeof window !== "undefined" &&
        document.startViewTransition &&
        !hasActiveStreaming
      ) {
        document.startViewTransition(switchTheme);
      } else {
        switchTheme();
      }
    }, [
      currentModeIndex,
      modes,
      setTheme,
      variant,
      start,
      animationVariant,
      updateStyles,
    ]);

    const handleIconClick = React.useCallback(
      (idx: number) => {
        if (variant === "circle-blur") {
          const animation = createAnimation(animationVariant, start);
          updateStyles(animation.css, animation.name);

          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 800);
        }

        const switchTheme = () => {
          setTheme(modes[idx]);
        };

        // Check if there are any active EventSource connections (streaming in progress)
        // Skip view transition during streaming to prevent DOM update blocking
        const hasActiveStreaming =
          typeof window !== "undefined" &&
          (window as any).__activeStreamingSessions > 0;

        if (
          variant === "circle-blur" &&
          typeof window !== "undefined" &&
          document.startViewTransition &&
          !hasActiveStreaming
        ) {
          document.startViewTransition(switchTheme);
        } else {
          switchTheme();
        }
      },
      [modes, setTheme, variant, start, animationVariant, updateStyles],
    );

    const [isClient, setIsClient] = React.useState(false);
    React.useEffect(() => {
      setIsClient(true);
    }, []);

    if (!isClient) return null;

    const switchWidth = modes.length === 2 ? "w-14" : "w-20";

    const isIconVisible = (index: number) => {
      if (index === currentModeIndex) return true;
      switch (showInactiveIcons) {
        case "none":
          return false;
        case "next":
          return index === (currentModeIndex + 1) % modes.length;
        case "all":
        default:
          return true;
      }
    };

    return (
      <div
        className={cn(
          "relative inline-flex h-8 rounded-full border border-input bg-background p-1 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          variant === "circle-blur" &&
            "backdrop-blur-md bg-background/80 border-border/50",
          switchWidth,
          className,
        )}
        onClick={
          variant === "default" || variant === "circle-blur"
            ? handleToggle
            : undefined
        }
        ref={ref}
        {...props}
      >
        {variant === "circle-blur" &&
          start === "bottom-left" &&
          isAnimating && (
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div className="absolute w-full h-full bg-gradient-to-tr from-primary/30 via-primary/20 to-transparent animate-[sweep_0.8s_ease-out_forwards] origin-bottom-left" />
            </div>
          )}

        {showActiveIconOnly ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background z-10">
              {icons[currentModeIndex]}
            </div>
          </div>
        ) : (
          <>
            <div className="flex w-full h-full items-center justify-between">
              {icons.map((icon, idx) => {
                const key = `theme-icon-${idx}`;
                const visible = isIconVisible(idx);

                return (
                  <div
                    key={key}
                    className={cn(
                      "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full z-10 transition-opacity duration-200",
                      currentModeIndex === idx
                        ? "text-background"
                        : "text-muted-foreground",
                      visible ? "opacity-100" : "opacity-0",
                    )}
                    onClick={(e) => {
                      if (
                        variant === "icon-click" ||
                        variant === "circle-blur"
                      ) {
                        e.stopPropagation();
                        handleIconClick(idx);
                      }
                    }}
                  >
                    {React.isValidElement(icon)
                      ? React.cloneElement(icon, { key: `icon-element-${idx}` })
                      : icon}
                  </div>
                );
              })}
            </div>

            <div
              className={cn(
                "absolute top-1 h-6 w-6 rounded-full transition-all duration-500 ease-out",
                variant === "circle-blur"
                  ? "bg-foreground/90 backdrop-blur-sm shadow-lg transform-gpu"
                  : "bg-foreground",
                variant === "circle-blur" &&
                  start === "bottom-left" &&
                  "transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                currentModeIndex === 0
                  ? "left-1"
                  : currentModeIndex === 1
                    ? modes.length === 2
                      ? "left-7"
                      : "left-[calc(50%-12px)]"
                    : "left-[calc(100%-28px)]",
              )}
              style={{
                transformOrigin:
                  variant === "circle-blur" && start === "bottom-left"
                    ? "bottom left"
                    : "center",
              }}
            />
          </>
        )}
      </div>
    );
  },
);

ThemeSwitch.displayName = "ThemeSwitch";

export { ThemeSwitch };
