import React, { useEffect, useMemo, useState } from "react";
import { X, Zap, Timer, Gauge, Sliders, Grid3X3Icon, Plus, Check } from "lucide-react";
import { toast } from "react-hot-toast";
import { TIME_PRESETS } from "../utils/timeControls";
import { BulletIcon } from "./GameSidebar";
import Avatar from "./Avatar";
import {
  useNotifications,
  CHALLENGE_TOAST_MS,
  CHALLENGE_TTL_MS as CHALLENGE_SENT_TTL_MS,
} from "../context/notificationContext";

const MODES = ["bullet", "blitz", "rapid", "custom"];

const MODE_ICONS = {
  bullet: BulletIcon,
  blitz: Zap,
  rapid: Timer,
  custom: Sliders,
};

// Same bucket thresholds GameSidebar uses when previewing where a custom
// time control lands (chess.com-style: <3min bullet, <10min blitz, else rapid).
const getTimeControlCategory = (baseInSecs, incInSecs) => {
  const totalMins = baseInSecs / 60 + (40 * incInSecs) / 60;
  if (totalMins < 3) return "Bullet";
  if (totalMins < 10) return "Blitz";
  return "Rapid";
};

export default function ChessboardWithPlus() {
  return (
    <div className="relative inline-block w-4 h-4">
      {/* Base Chessboard Icon */}
      <Grid3X3Icon className="w-full h-full text-brown-500" />
      {/* Overlayed Plus Icon Badge */}
      <div className="absolute bottom-0 right-0 translate-x-1 translate-y-1 bg-white rounded-full p-0.5 shadow-md border border-slate-100 flex items-center justify-center">
        <Plus className="w-1 h-1 text-emerald-600 stroke-[3]" />
      </div>

    </div>
  );
}

/**
 * A small "Challenge" button. Only ever renders when `status === "online"` —
 * players who are offline or currently in a game cannot be challenged, so
 * the button simply doesn't appear for them.
 */
export const ChallengeButton = ({ status, onClick, className = "", label = "Challenge" }) => {
  if (status !== "online") return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Challenge to a game"
      className={`flex items-center mr-1 ml-2 gap-1.5 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-600 text-indigo-400 hover:text-white rounded-lg font-medium text-xs transition-all cursor-pointer shrink-0 ${className}`}
    >
      <ChessboardWithPlus />
      {label}
    </button>
  );
};

/**
 * Popup shown when a "Challenge" button is clicked. Lets the challenger pick
 * Rated/Unrated and a time control, then hands the selection back via
 * `onConfirm({ targetUser, rated, mode, timeControl })`.
 */
export const ChallengeModal = ({ isOpen, onClose, targetUser, onConfirm }) => {
  const [rated, setRated] = useState(true);
  const [mode, setMode] = useState("rapid");
  const [selectedTimeControl, setSelectedTimeControl] = useState(
    TIME_PRESETS.rapid[0],
  );

  // Custom time control inputs (mirrors GameSidebar's "custom" tab)
  const [customMinutes, setCustomMinutes] = useState("10");
  const [customBaseSeconds, setCustomBaseSeconds] = useState("30");
  const [customBaseUnit, setCustomBaseUnit] = useState("minutes"); // "minutes" | "seconds"
  const [customIncrement, setCustomIncrement] = useState("5");

  // Reset to sensible defaults every time the modal is opened for a new
  // target, so leftover selections from a previous challenge don't linger.
  useEffect(() => {
    if (isOpen) {
      setRated(true);
      setMode("rapid");
      setSelectedTimeControl(TIME_PRESETS.rapid[0]);
      setCustomMinutes("10");
      setCustomBaseSeconds("30");
      setCustomBaseUnit("minutes");
      setCustomIncrement("5");
    }
  }, [isOpen, targetUser?._id]);

  const previewMins = Math.max(1, parseInt(customMinutes, 10) || 1);
  const previewBaseSecondsValue = Math.min(
    59,
    Math.max(10, parseInt(customBaseSeconds, 10) || 10),
  );
  const previewBaseTotalSeconds =
    customBaseUnit === "seconds" ? previewBaseSecondsValue : previewMins * 60;
  const previewInc = Math.max(0, parseInt(customIncrement, 10) || 0);
  const previewCategory = useMemo(
    () => getTimeControlCategory(previewBaseTotalSeconds, previewInc),
    [previewBaseTotalSeconds, previewInc],
  );
  const previewLabel =
    customBaseUnit === "seconds"
      ? `${previewBaseSecondsValue}s+${previewInc}`
      : `${previewMins}+${previewInc}`;

  const isCustomApplied =
    selectedTimeControl.isCustom &&
    selectedTimeControl.base === previewBaseTotalSeconds &&
    selectedTimeControl.increment === previewInc;

  if (!isOpen || !targetUser) return null;

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode !== "custom") {
      setSelectedTimeControl(TIME_PRESETS[newMode][0]);
    }
  };

  const applyCustomTime = () => {
    setSelectedTimeControl({
      base: previewBaseTotalSeconds,
      increment: previewInc,
      label: previewLabel,
      isCustom: true,
    });
    toast.success(
      `Custom time set: ${previewLabel} (${previewCategory})`,
    );
  };

  const handleConfirm = () => {
    if (mode === "custom" && !selectedTimeControl.isCustom) {
      toast.error("Apply your custom time control first");
      return;
    }

    onConfirm({
      targetUser,
      rated,
      mode,
      timeControl: selectedTimeControl,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar
              src={targetUser.avatar}
              username={targetUser.username}
              size="md"
            />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-zinc-100 truncate">
                Challenge {targetUser.username}
              </h2>
              <p className="text-xs text-zinc-400">Choose your game settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Rated / Unrated */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
              Game Type
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setRated(true)}
                className={`py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer border ${
                  rated
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                Rated
              </button>
              <button
                onClick={() => setRated(false)}
                className={`py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer border ${
                  !rated
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                Unrated
              </button>
            </div>
          </div>

          {/* Time control */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
              Time Control
            </h3>

            <div className="flex gap-2 mb-3">
              {MODES.map((m) => {
                const Icon = MODE_ICONS[m];
                return (
                  <button
                    key={m}
                    onClick={() => handleModeChange(m)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium capitalize transition-all cursor-pointer border ${
                      mode === m
                        ? "bg-zinc-800 border-zinc-600 text-white"
                        : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m}
                  </button>
                );
              })}
            </div>

            {mode !== "custom" ? (
              <div className="grid grid-cols-1 gap-2">
                {TIME_PRESETS[mode].map((tc) => {
                  const isSelected = selectedTimeControl.label === tc.label;
                  return (
                    <button
                      key={tc.label}
                      onClick={() => setSelectedTimeControl(tc)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600/10 border-indigo-500/50 text-indigo-300"
                          : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <span>{tc.label}</span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 bg-zinc-950/40 border border-zinc-800 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                        Base
                      </label>
                      <div className="flex gap-0.5 bg-zinc-900 border border-zinc-800 rounded-md p-0.5">
                        <button
                          type="button"
                          onClick={() => setCustomBaseUnit("minutes")}
                          className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded cursor-pointer transition ${
                            customBaseUnit === "minutes"
                              ? "bg-indigo-600 text-white"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          Min
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomBaseUnit("seconds")}
                          className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded cursor-pointer transition ${
                            customBaseUnit === "seconds"
                              ? "bg-indigo-600 text-white"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          Sec
                        </button>
                      </div>
                    </div>
                    {customBaseUnit === "minutes" ? (
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-center text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    ) : (
                      <input
                        type="number"
                        min="10"
                        max="59"
                        value={customBaseSeconds}
                        onChange={(e) => setCustomBaseSeconds(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-center text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1">
                      Increment (Secs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={customIncrement}
                      onChange={(e) => setCustomIncrement(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-center text-white focus:outline-none focus:border-indigo-500 font-mono mt-2"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={applyCustomTime}
                  className={`w-full py-2 transition rounded-lg text-xs font-bold border cursor-pointer shadow-sm flex items-center justify-center gap-1.5 ${
                    isCustomApplied
                      ? "bg-indigo-600/10 border-indigo-500/50 text-indigo-300"
                      : "bg-zinc-800 hover:bg-indigo-600 hover:text-white text-zinc-300 border-zinc-700/50"
                  }`}
                >
                  <span>{isCustomApplied ? "Applied" : "Apply Parameters"}</span>
                  <span className="text-[10px] bg-black/30 text-indigo-400 font-semibold px-1.5 py-0.5 rounded uppercase border border-white/5 mt-0.5">
                    {previewLabel} · {previewCategory}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-zinc-800 bg-zinc-950/40">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={mode === "custom" && !selectedTimeControl.isCustom}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ChessboardWithPlus className="w-4 h-4" />
            Send Challenge
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Global challenge notification center ────────────────────────────────
// State is owned by NotificationContext (shared with the notification
// bell in the Navbar) — this component just renders the floating toasts.

export const capitalize = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);

export const formatTimeControlLabel = (base, increment) => {
  if (base % 60 === 0) return `${base / 60}+${increment}`;
  return `${base}s+${increment}`;
};

export const ChallengeNotificationCenter = () => {
  const { activeChallenges, respondChallenge, sentChallenge, cancelChallenge } =
    useNotifications();

  const hasReceived = activeChallenges && activeChallenges.length > 0;
  const hasSent = Boolean(sentChallenge);

  if (!hasReceived && !hasSent) return null;

  return (
    <div className="fixed top-4 inset-x-0 z-100 flex flex-col items-center gap-3 px-4 pointer-events-none">
      {hasSent && (
        <SentChallengeBanner
          challenge={sentChallenge}
          onCancel={cancelChallenge}
        />
      )}
      {activeChallenges.map((challenge) => (
        <ChallengeToast
          key={challenge.challengeId}
          challenge={challenge}
          onRespond={respondChallenge}
        />
      ))}
    </div>
  );
};

// Shown to the CHALLENGER for as long as their own sent challenge is
// outstanding (toast phase + bell grace period on the receiving end, ~60s
// total), with a live countdown and a way to withdraw it early.
const SentChallengeBanner = ({ challenge, onCancel }) => {
  const {
    challengeId,
    targetUsername,
    targetAvatar,
    isRated,
    timeControl,
    gameType,
    sentAt,
  } = challenge;

  const [remaining, setRemaining] = useState(
    Math.max(
      0,
      Math.ceil((CHALLENGE_SENT_TTL_MS - (Date.now() - sentAt)) / 1000),
    ),
  );
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(
        Math.max(
          0,
          Math.ceil((CHALLENGE_SENT_TTL_MS - (Date.now() - sentAt)) / 1000),
        ),
      );
    }, 250);
    return () => clearInterval(interval);
  }, [sentAt]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const clockLabel = `${minutes}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="pointer-events-auto w-full max-w-md bg-zinc-900 border border-amber-500/40 rounded-2xl shadow-2xl shadow-black/50 p-4 flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-200">
      <Avatar src={targetAvatar} username={targetUsername} size="md" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-zinc-100 truncate">
          Waiting for {targetUsername || "opponent"} to respond
        </p>
        <p className="text-xs text-zinc-400 mt-0.5 truncate">
          {isRated ? "Rated" : "Unrated"} ·{" "}
          {formatTimeControlLabel(timeControl.base, timeControl.increment)} (
          {capitalize(gameType)})
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-mono text-zinc-500 w-9 text-center">
          {clockLabel}
        </span>
        <button
          onClick={() => {
            setCancelling(true);
            onCancel(challengeId);
          }}
          disabled={cancelling}
          title="Cancel challenge"
          className="p-2 rounded-lg bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const ChallengeToast = ({ challenge, onRespond }) => {
  const { challenger, isRated, timeControl, gameType, receivedAt, responding } =
    challenge;

  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((CHALLENGE_TOAST_MS - (Date.now() - receivedAt)) / 1000)),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(
        Math.max(
          0,
          Math.ceil((CHALLENGE_TOAST_MS - (Date.now() - receivedAt)) / 1000),
        ),
      );
    }, 250);
    return () => clearInterval(interval);
  }, [receivedAt]);

  return (
    <div className="pointer-events-auto w-full max-w-md bg-zinc-900 border border-indigo-500/40 rounded-2xl shadow-2xl shadow-black/50 p-4 flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-200">
      <Avatar src={challenger.avatar} username={challenger.username} size="md" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-zinc-100 truncate">
          {challenger.username} challenged you
        </p>
        <p className="text-xs text-zinc-400 mt-0.5 truncate">
          Rating {challenger.rating} · {isRated ? "Rated" : "Unrated"} ·{" "}
          {formatTimeControlLabel(timeControl.base, timeControl.increment)} (
          {capitalize(gameType)})
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-mono text-zinc-500 w-4 text-center">
          {remaining}
        </span>
        <button
          onClick={() => onRespond(challenge.challengeId, true)}
          disabled={responding}
          title="Accept"
          className="p-2 rounded-lg bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => onRespond(challenge.challengeId, false)}
          disabled={responding}
          title="Decline"
          className="p-2 rounded-lg bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};