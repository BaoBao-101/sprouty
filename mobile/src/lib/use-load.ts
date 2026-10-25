import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * Loads something for a screen, and loads it again when the screen comes
 * back into view or the app returns to the foreground — plants grow and
 * payments land while nobody is looking. `reload` is for pull-to-refresh.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    try {
      const next = await loadRef.current();
      setData(next);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Chưa tải được. Kéo xuống để thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLoading(true); void reload(); }, deps);

  // Not on the first focus (the effect above already loaded), on every one after.
  const focusedOnce = useRef(false);
  useFocusEffect(useCallback(() => {
    if (focusedOnce.current) void reload();
    focusedOnce.current = true;
  }, [reload]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void reload(); });
    return () => sub.remove();
  }, [reload]);

  return { data, setData, error, loading, reload };
}
