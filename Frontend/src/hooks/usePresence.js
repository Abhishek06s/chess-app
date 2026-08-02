import { useEffect, useState } from "react";
import { socket } from "../services/socket.service";

/**
 * Tracks live presence ("online" | "offline" | "in-game") for a list of
 * userIds. Fetches a snapshot for the given ids over the shared socket and
 * then keeps it fresh in real time via "presence-update" broadcasts.
 *
 * Returns a map of userId -> status. Ids with no known status yet are
 * simply absent from the map (callers should fall back to "offline").
 */
const usePresence = (userIds = []) => {
  const [statusMap, setStatusMap] = useState({});

  // Stable key so the effect only re-runs when the actual set of ids
  // changes, not on every render (arrays are recreated each render).
  const idsKey = (userIds || []).filter(Boolean).join(",");

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) return;

    const requestStatuses = () => {
      socket.emit("get-presence", ids, (statuses) => {
        if (statuses) {
          setStatusMap((prev) => ({ ...prev, ...statuses }));
        }
      });
    };

    if (socket.connected) {
      requestStatuses();
    }
    // Re-fetch a fresh snapshot whenever the socket (re)connects, in case
    // events were missed while it was down.
    socket.on("connect", requestStatuses);

    const handlePresenceUpdate = ({ userId, status }) => {
      if (ids.includes(userId)) {
        setStatusMap((prev) => ({ ...prev, [userId]: status }));
      }
    };

    socket.on("presence-update", handlePresenceUpdate);

    return () => {
      socket.off("connect", requestStatuses);
      socket.off("presence-update", handlePresenceUpdate);
    };
  }, [idsKey]);

  return statusMap;
};

export default usePresence;