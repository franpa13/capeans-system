import * as React from "react"

const MOBILE_BREAKPOINT = 768

/** Starts as `false` on both server and client — matching the server's
 * render, since it has no `window` to check — then corrects itself in an
 * effect once mounted. Reading window.innerWidth in the useState
 * initializer instead would make the client's first render (which does
 * have a real viewport) disagree with the server's, hydration-mismatching
 * the whole sidebar tree on every page load on a narrow screen. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
