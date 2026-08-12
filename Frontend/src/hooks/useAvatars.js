import { useEffect, useState } from "react";
import { getAvatarsByUsernames } from "../services/user.service";

const cache = new Map();

/**
 * Resolves avatars (and registration status) for a list of usernames —
 * e.g. PGN-imported player names, or multiplayer opponent names — that
 * aren't already carried on a richer object (profile/leaderboard/friend
 * responses already include `avatar` directly and don't need this hook).
 *
 * @param {string[]} usernames
 * @returns {Object<string, {found: boolean, avatar: string|null}>}
 */
export default function useAvatars(usernames = []) {
  const list = usernames.filter(Boolean);
  const key = [...new Set(list)].sort().join("|");

  const [avatars, setAvatars] = useState(() => {
    const initial = {};
    list.forEach((u) => {
      if (cache.has(u)) initial[u] = cache.get(u);
    });
    return initial;
  });

  useEffect(() => {
    if (list.length === 0) return;

    const missing = [...new Set(list)].filter((u) => !cache.has(u));

    const applyFromCache = () => {
      const next = {};
      list.forEach((u) => {
        next[u] = cache.has(u) ? cache.get(u) : { found: false, avatar: null };
      });
      setAvatars(next);
    };

    if (missing.length === 0) {
      applyFromCache();
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // The backend only includes a key for usernames that actually
        // exist in the DB — anything absent from `result` is unregistered.
        const result = await getAvatarsByUsernames(missing);
        missing.forEach((u) => {
          const found = Object.prototype.hasOwnProperty.call(result, u);
          cache.set(u, { found, avatar: found ? result[u] || null : null });
        });
      } catch {
        missing.forEach((u) => {
          if (!cache.has(u)) cache.set(u, { found: false, avatar: null });
        });
      } finally {
        if (!cancelled) applyFromCache();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return avatars;
}