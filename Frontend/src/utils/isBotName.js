import { BOT_DIFFICULTIES } from "./botDifficulty";

const KNOWN_BOT_NAMES = new Set([
  ...BOT_DIFFICULTIES.map((tier) => `${tier.label} Bot`),
  "Stockfish Bot",
]);

export const isKnownBotName = (name = "") => KNOWN_BOT_NAMES.has(name.trim());

/**
 * Decide whether a PGN-imported player name should show the bot icon.
 *
 * @param {string} name - the raw White/Black name from the PGN header
 * @param {boolean} isRegisteredUser - true if this name matched a real
 *   account in the database (see useAvatars' `found` flag). A registered
 *   account is NEVER treated as a bot, no matter what its name looks like.
 */
export const isBotOrGhostBotName = (name = "", isRegisteredUser = false) =>
  !isRegisteredUser && isKnownBotName(name);