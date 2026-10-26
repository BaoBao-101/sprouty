import { useEffect, useState } from 'react';
import { API } from './api';
import { useAuth } from './auth';

/** The scene and pot the account's garden wears (GardenStyle picks them), for the plant cards. */
export interface GardenLook {
  scene: string;
  decoration: string;
}

let current: { user: string; look: GardenLook } | null = null;
let loading: { user: string; promise: Promise<void> } | null = null;
const listeners = new Set<(look: GardenLook) => void>();

/** A VIP saved a new look: every card follows. */
export function setGardenLook(look: GardenLook) {
  if (current) current = { ...current, look };
  listeners.forEach((on) => on(look));
}

/** The signed-in account's look, loaded once and shared; null until it is known. */
export function useGardenLook(): GardenLook | null {
  const { user } = useAuth();
  const id = user?.id ?? '';
  const [look, setLook] = useState<GardenLook | null>(current?.user === id ? current.look : null);

  useEffect(() => {
    if (!id) return;
    listeners.add(setLook);
    if (current?.user === id) setLook(current.look);
    else if (loading?.user !== id) {
      loading = {
        user: id,
        promise: API.garden.benefits()
          .then((b: any) => {
            current = { user: id, look: { scene: b?.scene || 'natural', decoration: b?.decoration || 'plain' } };
            listeners.forEach((on) => on(current!.look));
          })
          .catch(() => { loading = null; }),
      };
    }
    return () => { listeners.delete(setLook); };
  }, [id]);

  return id ? look : null;
}
