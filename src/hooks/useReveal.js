import { useEffect } from "react";

/**
 * Fades/slides in any [data-reveal] element within this page once it's
 * scrolled into view. Re-runs whenever `deps` changes (e.g. after async
 * content replaces the DOM), matching the original vanilla-JS wireReveal().
 */
export function useReveal(deps = []) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const revealEls = document.querySelectorAll("[data-reveal]:not(.in)");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    revealEls.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
