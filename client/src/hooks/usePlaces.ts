import { useCallback, useEffect, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { placesStore, getSensitiveWords } from '@client/src/lib/storage';
import { filterSensitiveWords } from '@client/src/lib/utils/sensitive';
import { haversineDistance } from '@client/src/lib/utils/geo';

/** 保存时统一走的敏感词过滤（内置 + 自定义词库） */
function filterOnSave(text: string): string {
  try {
    const customWords = getSensitiveWords();
    return filterSensitiveWords(text, customWords);
  } catch {
    return text;
  }
}

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius: number;
  tag: 'home' | 'company' | 'school' | 'other';
}

function genId(): string {
  return `place_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>([]);

  const loadPlaces = useCallback(async () => {
    try {
      const list: Place[] = await placesStore.getAll<Place>();
      setPlaces(list);
    } catch (err) {
      logger.error('load places failed', err);
    }
  }, []);

  useEffect(() => {
    loadPlaces();
  }, [loadPlaces]);

  const addPlace = useCallback(
    async (place: Omit<Place, 'id'>) => {
      const newPlace: Place = {
        radius: 200,
        ...place,
        id: genId(),
        name: filterOnSave(place.name),
      };
      await placesStore.put(newPlace);
      await loadPlaces();
      return newPlace;
    },
    [loadPlaces],
  );

  const updatePlace = useCallback(
    async (id: string, updates: Partial<Place>) => {
      const existing = await placesStore.get<Place>(id);
      if (!existing) return;
      const updated: Place = {
        ...existing,
        ...updates,
        name: updates.name !== undefined ? filterOnSave(updates.name) : existing.name,
      };
      await placesStore.put(updated);
      await loadPlaces();
    },
    [loadPlaces],
  );

  const deletePlace = useCallback(
    async (id: string) => {
      await placesStore.delete(id);
      await loadPlaces();
    },
    [loadPlaces],
  );

  const findNearbyPlace = useCallback(
    (lat: number, lng: number): Place | null => {
      for (const p of places) {
        const distMeters = haversineDistance(lat, lng, p.lat, p.lng) * 1000;
        if (distMeters <= p.radius) return p;
      }
      return null;
    },
    [places],
  );

  return {
    places,
    loadPlaces,
    addPlace,
    updatePlace,
    deletePlace,
    findNearbyPlace,
  };
}
