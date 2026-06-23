import { useState, useCallback } from 'react';

export function usePersistedNumber(key: string, defaultValue: number): [number, (val: number) => void] {
  const [value, setValue] = useState(() => {
    const stored = sessionStorage.getItem(key);
    return stored ? parseInt(stored, 10) || defaultValue : defaultValue;
  });

  const set = useCallback((val: number) => {
    sessionStorage.setItem(key, String(val));
    setValue(val);
  }, [key]);

  return [value, set];
}
