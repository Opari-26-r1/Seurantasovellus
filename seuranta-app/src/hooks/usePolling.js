import { useEffect, useState } from 'react';
import { apiGet } from '../api';

/**
 * Hakee polun heti ja sen jälkeen intervalMs välein.
 * - Seuraava haku ajastetaan vasta edellisen valmistuttua, joten pyynnöt eivät kasaannu.
 * - Kun välilehti ei ole näkyvissä, hakuja ei tehdä.
 * - Virheen sattuessa edellinen data jää näkyviin.
 */
export default function usePolling(path, intervalMs) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    let timer;
    setState({ data: null, error: null, loading: true });

    const tick = async () => {
      if (document.visibilityState !== 'hidden') {
        try {
          const data = await apiGet(path);
          if (!cancelled) setState({ data, error: null, loading: false });
        } catch (error) {
          if (!cancelled) setState((s) => ({ data: s.data, error, loading: false }));
        }
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [path, intervalMs]);

  return state;
}
