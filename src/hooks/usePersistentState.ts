import { useCallback, useEffect, useRef, useState } from "react";

type Initializer<T> = T | (() => T);

interface PersistentStateControls {
  reset: () => void;
  hydrated: boolean;
  sync: () => void;
}

const isBrowser = typeof window !== "undefined";

function resolveInitializer<T>(value: Initializer<T>): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

function readFromStorage<T>(key: string, fallback: T): T {
  if (!isBrowser) {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(key);
    if (stored == null) {
      return fallback;
    }

    const parsed = JSON.parse(stored) as unknown;

    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? (parsed as T) : fallback;
    }

    if (
      typeof fallback === "object" &&
      fallback !== null &&
      !Array.isArray(fallback) &&
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return {
        ...(fallback as Record<string, unknown>),
        ...(parsed as Record<string, unknown>),
      } as T;
    }

    return parsed as T;
  } catch (error) {
    console.warn("Failed to read from localStorage", error);
    return fallback;
  }
}

function writeToStorage<T>(key: string, value: T) {
  if (!isBrowser) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to persist to localStorage", error);
  }
}

function removeFromStorage(key: string) {
  if (!isBrowser) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn("Failed to remove localStorage item", error);
  }
}

export function usePersistentState<T>(key: string, initializer: Initializer<T>) {
  const initializerRef = useRef<Initializer<T>>(initializer);
  initializerRef.current = initializer;

  const defaultValueRef = useRef<T>(resolveInitializer(initializerRef.current));

  const [state, setState] = useState<T>(() => readFromStorage(key, defaultValueRef.current));
  const [hydrated, setHydrated] = useState<boolean>(() => !isBrowser);
  const lastSyncedValueRef = useRef<T>(state);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (lastSyncedValueRef.current === state) {
      return;
    }

    writeToStorage(key, state);
    lastSyncedValueRef.current = state;
  }, [state, hydrated, key]);

  const reset = useCallback(() => {
    const nextDefault = resolveInitializer(initializerRef.current);
    defaultValueRef.current = nextDefault;
    setState(nextDefault);
    lastSyncedValueRef.current = nextDefault;
    removeFromStorage(key);
  }, [key]);

  const sync = useCallback(() => {
    writeToStorage(key, state);
    lastSyncedValueRef.current = state;
  }, [state, key]);

  const controls: PersistentStateControls = {
    reset,
    hydrated,
    sync,
  };

  return [state, setState, controls] as const;
}
