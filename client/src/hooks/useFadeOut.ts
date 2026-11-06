import { useEffect, type RefObject } from 'react';

const DURATION = 200;

// When the element is removed (a modal or the AI panel closes), put a copy of it on the page and fade the copy out.
// This way every way of closing (Esc, Cancel, Save, ...) fades out, without each parent having to wait.
// `wrapInBackdrop` = also fade a dark backdrop (for modals).
export function useFadeOut(ref: RefObject<HTMLElement | null>, wrapInBackdrop = false) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    return () => {
      // React's StrictMode runs this cleanup once in development without really removing the element.
      if (node.isConnected) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const ghost = node.cloneNode(true) as HTMLElement;
      ghost.classList.add('fade-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.inert = true;
      ghost.removeAttribute('id');

      let wrapper: HTMLElement = ghost;
      if (wrapInBackdrop) {
        wrapper = document.createElement('div');
        wrapper.className = 'fade-ghost-backdrop';
        wrapper.appendChild(ghost);
      }
      document.body.appendChild(wrapper);
      window.setTimeout(() => wrapper.remove(), DURATION);
    };
  }, [ref, wrapInBackdrop]);
}
