import usePolling from './usePolling';

/** Backendin tila otsikkoa varten: 'loading' | 'ok' | 'error' */
export default function useBackendStatus() {
  const { data, error } = usePolling('/status', 30000);
  if (error) return 'error';
  if (!data) return 'loading';
  return data.backend === 'ok' ? 'ok' : 'error';
}
