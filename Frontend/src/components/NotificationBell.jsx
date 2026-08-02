import React, { useEffect, useRef, useState } from "react";
import { Bell, Check, X, Swords, UserPlus, Trash2 } from "lucide-react";
import { useNotifications } from "../context/notificationContext";
import { capitalize, formatTimeControlLabel } from "./Challenge";

const timeAgo = (ts) => {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const FriendRequestRow = ({ notification, onAccept, onReject }) => {
  const [busy, setBusy] = useState(false);

  const act = async (fn) => {
    setBusy(true);
    await fn(notification.userId);
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-3 p-3 border-b border-zinc-800 last:border-b-0">
      <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shrink-0">
        <UserPlus className="w-4 h-4 text-emerald-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-100 truncate">
          {notification.username}
        </p>
        <p className="text-xs text-zinc-500">
          Sent you a friend request · {timeAgo(notification.receivedAt)}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => act(onAccept)}
          disabled={busy}
          title="Accept"
          className="p-1.5 rounded-lg bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => act(onReject)}
          disabled={busy}
          title="Decline"
          className="p-1.5 rounded-lg bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const ChallengeHistoryRow = ({ notification }) => (
  <div className="flex items-center gap-3 p-3 border-b border-zinc-800 last:border-b-0 opacity-80">
    <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl shrink-0">
      <Swords className="w-4 h-4 text-indigo-400" />
    </div>

    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-zinc-100 truncate">
        {notification.challenger?.username}
      </p>
      <p className="text-xs text-zinc-500 truncate">
        {formatTimeControlLabel(
          notification.timeControl?.base,
          notification.timeControl?.increment,
        )}{" "}
        · {capitalize(notification.gameType)} ·{" "}
        {notification.isRated ? "Rated" : "Unrated"}
      </p>
    </div>

    <span className="text-[10px] font-bold uppercase tracking-wide text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-md px-2 py-1 shrink-0">
      Declined
    </span>
  </div>
);

const NotificationBell = () => {
  const { notifications, unreadCount, acceptFriend, rejectFriend, clearAll } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute bottom-0.5 right-0.5 translate-x-1/2 translate-y-1/2 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none border-2 border-zinc-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-3 z-50 w-[92vw] sm:w-[25vw] sm:min-w-[320px] max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 origin-top-right"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-100">Notifications</h3>
            <button
              onClick={clearAll}
              disabled={notifications.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-zinc-400 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear notifications
            </button>
          </div>

          {/* List */}
          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">
                  You're all caught up — no notifications.
                </p>
              </div>
            ) : (
              notifications.map((n) =>
                n.type === "friend_request" ? (
                  <FriendRequestRow
                    key={n.id}
                    notification={n}
                    onAccept={acceptFriend}
                    onReject={rejectFriend}
                  />
                ) : (
                  <ChallengeHistoryRow key={n.id} notification={n} />
                ),
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;