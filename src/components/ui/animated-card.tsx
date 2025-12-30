import * as React from "react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { cn } from "@/lib/utils";

interface AnimatedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  delay?: number;
  animation?: 'fade-up' | 'fade-left' | 'fade-right' | 'scale' | 'fade';
}

const AnimatedCard = React.forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ children, className, delay = 0, animation = 'fade-up', ...props }, forwardedRef) => {
    const { ref, isVisible } = useScrollAnimation<HTMLDivElement>({
      threshold: 0.1,
      triggerOnce: true,
    });

    const getAnimationClasses = () => {
      const baseClasses = 'transition-all duration-700 ease-out';
      
      if (!isVisible) {
        switch (animation) {
          case 'fade-up':
            return `${baseClasses} opacity-0 translate-y-8`;
          case 'fade-left':
            return `${baseClasses} opacity-0 translate-x-8`;
          case 'fade-right':
            return `${baseClasses} opacity-0 -translate-x-8`;
          case 'scale':
            return `${baseClasses} opacity-0 scale-95`;
          case 'fade':
          default:
            return `${baseClasses} opacity-0`;
        }
      }
      
      return `${baseClasses} opacity-100 translate-y-0 translate-x-0 scale-100`;
    };

    // Combine refs
    const combinedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        // Set the internal ref
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        // Forward to external ref if provided
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [ref, forwardedRef]
    );

    return (
      <div
        ref={combinedRef}
        className={cn(getAnimationClasses(), className)}
        style={{ transitionDelay: `${delay}ms` }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

AnimatedCard.displayName = "AnimatedCard";

export { AnimatedCard };
