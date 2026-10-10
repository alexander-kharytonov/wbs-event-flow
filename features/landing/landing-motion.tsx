"use client";

import { stagger, useAnimate, useInView, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect } from "react";

type LandingAnimation =
  | "hero"
  | "flow"
  | "heading"
  | "stage"
  | "feature"
  | "steps"
  | "closing"
  | "fade";

// All content is visible in server HTML; each animation starts after hydration.
export function LandingMotion({
  children,
  className,
  variant = "fade",
}: {
  children: ReactNode;
  className?: string;
  variant?: LandingAnimation;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const inView = useInView(scope, { once: true, amount: 0.2 });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!inView || reducedMotion !== false) {
      return;
    }

    const animations: ReturnType<typeof animate>[] = [];
    const reveal = { duration: 0.7, ease: "easeOut" as const };

    switch (variant) {
      case "hero":
        animations.push(
          animate(
            "h1",
            { clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"] },
            { duration: 0.95, ease: [0.22, 1, 0.36, 1] },
          ),
          animate(
            "p, a",
            { opacity: [0.5, 1] },
            { duration: 0.7, delay: stagger(0.08, { startDelay: 0.2 }) },
          ),
        );
        break;
      case "flow":
        animations.push(
          animate(
            "[data-flow-progress]",
            { scaleY: [0, 1] },
            { duration: 2.3, ease: "easeInOut" },
          ),
          animate(
            "[data-flow-step]",
            { x: [24, 0], opacity: [0.5, 1] },
            { ...reveal, delay: stagger(0.4) },
          ),
          animate(
            "[data-flow-number]",
            { scale: [1, 1.2, 1] },
            { duration: 0.65, delay: stagger(0.4) },
          ),
          animate(
            "[data-flow-card]",
            {
              borderColor: [
                "var(--mui-palette-divider)",
                "var(--mui-palette-primary-main)",
                "var(--mui-palette-divider)",
              ],
            },
            { duration: 1.1, delay: stagger(0.4) },
          ),
          animate(
            "[data-flow-status]",
            { opacity: [0.25, 1] },
            { duration: 0.5, delay: stagger(0.4, { startDelay: 0.35 }) },
          ),
        );
        break;
      case "heading":
        animations.push(
          animate(
            "h2",
            { clipPath: ["inset(0 0 100% 0)", "inset(0 0 0% 0)"] },
            reveal,
          ),
        );
        break;
      case "stage":
        animations.push(
          animate(
            "[data-stage-number]",
            { scale: [0.8, 1], opacity: [0.4, 1] },
            { type: "spring", stiffness: 160, damping: 18 },
          ),
          animate(
            "li",
            { opacity: [0.4, 1] },
            { duration: 0.45, delay: stagger(0.12) },
          ),
        );
        break;
      case "feature":
        animations.push(
          animate(
            "[data-feature-icon]",
            { rotate: [-25, 0], scale: [0.65, 1] },
            { type: "spring", stiffness: 180, damping: 14 },
          ),
        );
        break;
      case "steps":
        animations.push(
          animate(
            "[data-attendee-step]",
            { x: [28, 0], opacity: [0.4, 1] },
            { ...reveal, delay: stagger(0.18) },
          ),
        );
        break;
      case "closing":
        animations.push(
          animate(
            "svg",
            { scale: [0.6, 1], rotate: [-45, 0] },
            { type: "spring", stiffness: 130, damping: 13 },
          ),
          animate(
            "h2 span",
            { opacity: [0.4, 1], filter: ["blur(6px)", "blur(0px)"] },
            { duration: 0.8, delay: 0.2 },
          ),
        );
        break;
      default:
        animations.push(animate(scope.current, { opacity: [0.6, 1] }, reveal));
    }

    return () => {
      for (const animation of animations) {
        // Restore the final readable state even if reduced motion changes mid-flight.
        animation.complete();
      }
    };
  }, [animate, inView, reducedMotion, scope, variant]);

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
