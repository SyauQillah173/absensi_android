import React, { useEffect, useState } from 'react';

interface CountUpNumberProps {
  end: number;
  duration?: number; // dalam milidetik, default 1200ms
  formatter?: (val: number) => string;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * Komponen Animasi Angka Berhitung (Count-Up) Modern & Ringan
 * Menggunakan requestAnimationFrame & easeOutExpo untuk visual yang halus 60fps
 */
export function CountUpNumber({
  end,
  duration = 1200,
  formatter,
  prefix = '',
  suffix = '',
  className = '',
}: CountUpNumberProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = 0;
    const endValue = Number(end) || 0;

    if (endValue === 0) {
      setCount(0);
      return;
    }

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Easing function: easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentVal = Math.floor(startValue + (endValue - startValue) * easeProgress);

      setCount(currentVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setCount(endValue);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [end, duration]);

  const displayValue = formatter ? formatter(count) : count.toLocaleString('id-ID');

  return (
    <span className={className}>
      {prefix}{displayValue}{suffix}
    </span>
  );
}
