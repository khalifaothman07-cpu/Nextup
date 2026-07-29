import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      // Wait a tick so the destination page has rendered before we look
      // for the element to scroll to.
      const id = location.hash.slice(1);
      const timer = setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => clearTimeout(timer);
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return null;
}
