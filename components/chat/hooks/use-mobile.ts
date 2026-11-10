// Rebuilt on useMediaQuery (audit #4): the old state+effect version returned
// false on first paint then flipped, flashing the whole sidebar between mobile
// Sheet and desktop rail on load.

import { useMediaQuery } from "./use-media-query";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}
