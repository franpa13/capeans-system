"use client";

import { useEffect } from "react";

/** Opens the print dialog once the receta (and its signature image) has
 * loaded — "Imprimir / PDF" lands straight on it. */
export function PrintOnLoad() {
  useEffect(() => {
    const print = () => window.print();
    if (document.readyState === "complete") {
      const timer = setTimeout(print, 300);
      return () => clearTimeout(timer);
    }
    window.addEventListener("load", print, { once: true });
    return () => window.removeEventListener("load", print);
  }, []);
  return null;
}
