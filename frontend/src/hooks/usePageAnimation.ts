import { useEffect, useRef, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { animatePageEnter } from '../lib/animations';

export function usePageAnimation(): RefObject<HTMLDivElement> {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (containerRef.current) {
      animatePageEnter(containerRef.current);
    }
  }, [location.pathname]);

  return containerRef;
}

