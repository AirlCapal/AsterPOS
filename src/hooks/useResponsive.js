import { useState, useEffect } from 'react';

/**
 * Responsive Font & Layout Utility
 * Provides fluid scaling and dimension tracking similar to React Native's useWindowDimensions.
 */
export function useResponsive() {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    isMobile: window.innerWidth < 640,
    isTablet: window.innerWidth >= 640 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 640,
        isTablet: window.innerWidth >= 640 && window.innerWidth < 1024,
        isDesktop: window.innerWidth >= 1024,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Responsive scale function for manual style overrides if needed
  const scale = (size) => {
    const baseWidth = 375; // baseline mobile width
    return (dimensions.width / baseWidth) * size;
  };

  return { ...dimensions, scale };
}
