// 🆕 Feature #14: Web Animations API Integration
import React, { useRef } from 'react';
import { bounce, shake, pulse, fadeIn, successCheckmark } from '../services/webAnimations';

type AnimationType = 'bounce' | 'shake' | 'pulse' | 'fadeIn' | 'success';

interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  animation?: AnimationType;
  animateOnClick?: boolean;
  children: React.ReactNode;
}

/**
 * Button with built-in Web Animations API (Feature #14)
 * 
 * Usage:
 * ```tsx
 * <AnimatedButton animation="bounce" animateOnClick>Click Me</AnimatedButton>
 * <AnimatedButton animation="shake">Error Button</AnimatedButton>
 * ```
 */
export const AnimatedButton: React.FC<AnimatedButtonProps> = ({ 
  animation = 'bounce',
  animateOnClick = true,
  onClick,
  children,
  className = '',
  ...props 
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (animateOnClick && buttonRef.current) {
      switch (animation) {
        case 'bounce':
          bounce(buttonRef.current);
          break;
        case 'shake':
          shake(buttonRef.current);
          break;
        case 'pulse':
          pulse(buttonRef.current, { iterations: 2 });
          break;
        case 'success':
          successCheckmark(buttonRef.current);
          break;
        case 'fadeIn':
          fadeIn(buttonRef.current);
          break;
      }
    }
    
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
};

/**
 * Success button with checkmark animation
 */
export const SuccessButton: React.FC<Omit<AnimatedButtonProps, 'animation'>> = (props) => {
  return <AnimatedButton animation="success" {...props} />;
};

/**
 * Error button with shake animation
 */
export const ErrorButton: React.FC<Omit<AnimatedButtonProps, 'animation'>> = (props) => {
  return <AnimatedButton animation="shake" {...props} />;
};
