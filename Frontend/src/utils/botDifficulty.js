// Stockfish parameters:
//   - elo:            the Elo rating shown in the UI / stored in history, and
//                      (when limitStrength is true) sent as UCI_Elo.
//   - depth:          fixed search depth used for "go depth N". Shallower for
//                      weak tiers (fewer tactics found, faster replies),
//                      deeper for strong tiers (sharper tactical play).
//   - limitStrength:  whether UCI_LimitStrength is enabled. True for every
//                      tier except "invincible", which instead runs Stockfish
//                      completely unrestricted at high depth so it genuinely
//                      plays at full strength rather than being capped by the
//                      engine's own (imperfect, human-like) weakening model.
//
// This intentionally produces the gradient described in product terms:
//   Very Easy / Easy   -> weak everywhere, including the opening and endgame.
//   Medium / Hard      -> sound openings, but tactically fallible (Medium
//                          more so than Hard) in sharp positions.
//   Extreme            -> essentially always correct, rare misses only in
//                          very complex positions.
//   Invincible         -> unrestricted full-strength engine play.

export const BOT_DIFFICULTIES = [
  {
    key: "very_easy",
    label: "Very Easy",
    elo: 200,
    depth: 5,
    limitStrength: true,
  },
  {
    key: "easy",
    label: "Easy",
    elo: 800,
    depth: 8,
    limitStrength: true,
  },
  {
    key: "medium",
    label: "Medium",
    elo: 1400,
    depth: 12,
    limitStrength: true,
  },
  {
    key: "hard",
    label: "Hard",
    elo: 2000,
    depth: 16,
    limitStrength: true,
  },
  {
    key: "extreme",
    label: "Extreme",
    elo: 2700,
    depth: 20,
    limitStrength: true,
  },
  {
    key: "invincible",
    label: "Invincible",
    elo: 3600,
    depth: 24,
    limitStrength: false,
  },
];

export const DEFAULT_BOT_DIFFICULTY_KEY = "medium";

/** Look up a difficulty preset by key, falling back to the default tier. */
export function getBotDifficulty(key) {
  return (
    BOT_DIFFICULTIES.find((tier) => tier.key === key) ||
    BOT_DIFFICULTIES.find((tier) => tier.key === DEFAULT_BOT_DIFFICULTY_KEY)
  );
}