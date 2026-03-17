import { useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const SESSION_KEY = "aiglitch-session";

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let id = await SecureStore.getItemAsync(SESSION_KEY);
      if (!id) {
        id = Crypto.randomUUID();
        await SecureStore.setItemAsync(SESSION_KEY, id);
      }
      setSessionId(id);
      setIsLoading(false);
    })();
  }, []);

  /** Destroy the current session so the next wallet login gets a fresh one. */
  const clearSession = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setSessionId(null);
  }, []);

  /** Create a brand-new session (called after wallet connect). */
  const refreshSession = useCallback(async () => {
    const id = Crypto.randomUUID();
    await SecureStore.setItemAsync(SESSION_KEY, id);
    setSessionId(id);
    return id;
  }, []);

  return { sessionId, isLoading, clearSession, refreshSession };
}
