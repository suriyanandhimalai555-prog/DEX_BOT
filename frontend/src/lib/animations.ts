import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function animatePageEnter(container: HTMLElement): void {
  const elements = container.querySelectorAll('[data-animate]');
  gsap.fromTo(
    elements,
    { opacity: 0, y: 24, filter: 'blur(4px)' },
    {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 0.6,
      ease: 'power3.out',
      stagger: 0.06,
      clearProps: 'filter',
    }
  );
}

export function animateCounter(
  element: HTMLElement,
  from: number,
  to: number,
  decimals = 0,
  suffix = ''
): void {
  const obj = { val: from };
  gsap.to(obj, {
    val: to,
    duration: 1.2,
    ease: 'power2.out',
    onUpdate: () => {
      element.textContent = obj.val.toFixed(decimals) + suffix;
    },
  });
}

export function cardHoverEnter(card: HTMLElement): void {
  gsap.to(card, {
    y: -3,
    boxShadow: '0 8px 32px -8px rgba(16, 185, 129, 0.18)',
    duration: 0.3,
    ease: 'power2.out',
  });
}

export function cardHoverLeave(card: HTMLElement): void {
  gsap.to(card, {
    y: 0,
    boxShadow: 'var(--shadow-card)',
    duration: 0.3,
    ease: 'power2.out',
  });
}

export function animateModalEnter(overlay: HTMLElement, panel: HTMLElement): void {
  gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
  gsap.fromTo(
    panel,
    { opacity: 0, scale: 0.95, y: 16 },
    { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'power3.out' }
  );
}

export function animateModalExit(
  overlay: HTMLElement,
  panel: HTMLElement,
  onComplete: () => void
): void {
  gsap.to(panel, { opacity: 0, scale: 0.95, y: 8, duration: 0.2, ease: 'power2.in' });
  gsap.to(overlay, { opacity: 0, duration: 0.2, ease: 'power2.in', onComplete });
}

export function animateListEnter(items: NodeListOf<Element> | Element[]): void {
  gsap.fromTo(
    items,
    { opacity: 0, x: -12 },
    {
      opacity: 1,
      x: 0,
      duration: 0.4,
      ease: 'power2.out',
      stagger: 0.04,
    }
  );
}

export function animateTxRowEnter(row: HTMLElement): void {
  gsap.fromTo(
    row,
    { opacity: 0, x: -20, backgroundColor: 'rgba(16,185,129,0.08)' },
    {
      opacity: 1,
      x: 0,
      backgroundColor: 'rgba(16,185,129,0)',
      duration: 0.5,
      ease: 'power2.out',
    }
  );
}

export function startPulseDot(dot: HTMLElement): gsap.core.Tween {
  return gsap.to(dot, {
    scale: 1.4,
    opacity: 0.4,
    duration: 1,
    ease: 'power1.inOut',
    yoyo: true,
    repeat: -1,
  });
}

export function animateButtonPress(btn: HTMLElement): void {
  gsap.to(btn, {
    scale: 0.96,
    duration: 0.1,
    ease: 'power2.in',
    onComplete: () => {
      gsap.to(btn, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
    },
  });
}

export function animateNavIndicator(indicator: HTMLElement, targetY: number): void {
  gsap.to(indicator, {
    y: targetY,
    duration: 0.4,
    ease: 'power3.out',
  });
}

export function scrollReveal(element: HTMLElement): void {
  gsap.fromTo(
    element,
    { opacity: 0, y: 40 },
    {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: element,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    }
  );
}

export function tickerUpdate(element: HTMLElement, newValue: number, decimals = 0): void {
  const current = Number.parseFloat(element.textContent ?? '0');
  animateCounter(element, Number.isNaN(current) ? 0 : current, newValue, decimals);
}

export function flashBotCard(cardEl: HTMLElement, type: 'success' | 'warning' | 'danger'): void {
  const colors: Record<'success' | 'warning' | 'danger', string> = {
    success: 'rgba(16,185,129,0.1)',
    warning: 'rgba(245,158,11,0.1)',
    danger: 'rgba(239,68,68,0.1)',
  };
  gsap.to(cardEl, {
    backgroundColor: colors[type],
    duration: 0.2,
    ease: 'power2.out',
    onComplete: () => {
      gsap.to(cardEl, {
        backgroundColor: '#ffffff',
        duration: 0.6,
        ease: 'power2.out',
      });
    },
  });
}

