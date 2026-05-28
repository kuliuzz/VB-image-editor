// Generic debounce hook: fires a callback with the latest value only after the specified delay has passed since the last change.

import { useEffect, useRef } from "react";

export function useDebounce<T>(value: T, delay: number, callback: (v: T) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => callbackRef.current(value), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delay]);
}
