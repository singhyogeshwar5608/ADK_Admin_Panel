import { useEffect } from "react";

/**
 * Removes stray full-screen overlays without real dialog content (reconstructed from bundle `NP`).
 */
export function ModalOverlayCleanup() {
  useEffect(() => {
    const run = () => {
      document.querySelectorAll(".fixed.inset-0").forEach((el) => {
        const root = el as HTMLElement;
        const form = root.querySelector("form");
        const dialog = root.querySelector('[role="dialog"]');
        const focusable = root.querySelector("input") || root.querySelector("button");
        if (!form && !dialog && !focusable) root.remove();
      });
    };
    run();
    const t = window.setTimeout(run, 100);
    return () => clearTimeout(t);
  }, []);
  return null;
}
