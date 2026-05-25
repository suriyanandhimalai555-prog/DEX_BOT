import { useEffect } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { destroyLenis, initLenis } from '../lib/lenis';

gsap.registerPlugin(ScrollTrigger);

export function useLenis(): void {
  useEffect(() => {
    const lenis = initLenis();

    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const onScroll = () => {
      ScrollTrigger.update();
    };
    lenis.on('scroll', onScroll);

    return () => {
      gsap.ticker.remove(raf);
      lenis.off('scroll', onScroll);
      destroyLenis();
    };
  }, []);
}

