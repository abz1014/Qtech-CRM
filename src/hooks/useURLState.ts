import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useURLState(key: string, defaultValue: string): [string, (val: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(key) ?? defaultValue;

  const setValue = useCallback((val: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val === defaultValue) {
        next.delete(key);
      } else {
        next.set(key, val);
      }
      return next;
    }, { replace: true });
  }, [key, defaultValue, setSearchParams]);

  return [value, setValue];
}

export function useURLNumber(key: string, defaultValue: number): [number, (val: number) => void] {
  const [raw, setRaw] = useURLState(key, String(defaultValue));
  const value = parseInt(raw, 10) || defaultValue;
  const setValue = useCallback((val: number) => setRaw(String(val)), [setRaw]);
  return [value, setValue];
}
