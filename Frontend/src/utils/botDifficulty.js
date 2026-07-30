// Stockfish parameters:
//   - elo:                display-only rating shown in the UI / stored in
//                         game history. Not sent to the engine anymore (see
//                         below for why).
//   - depth:              fixed search depth used for "go depth N". This is
//                         the bot's raw "chess understanding" for the tier -
//                         shallower for weak tiers (misses deep tactics
//                         naturally), deeper for strong tiers. Kept low for
//                         the weak tiers on purpose - modern Stockfish is
//                         still dangerously strong at depth 9-12, so "easy"
//                         and "medium" need genuinely shallow search, not
//                         just a higher mistake roll, or they still play
//                         like a strong club player.
//   - multiPV:            how many candidate moves Stockfish is asked to
//                         rank (via "setoption name MultiPV"), each with its
//                         own evaluation. This is the pool of moves the bot
//                         is allowed to pick from - wider pool = more room
//                         for a tier to plausibly deviate from the objective
//                         best move.
//   - mistakeChance:      probability (0-1), rolled once per bot move, that
//                         the bot deliberately plays something other than
//                         the #1 (best) move from that MultiPV pool.
//   - maxCentipawnLoss:   when a mistake is rolled, only candidates whose
//                         evaluation is within this many centipawns of the
//                         best move are eligible. This bounds *how bad* a
//                         mistake can be for a given tier.
//   - mistakeSoftening:   controls how the eligible "mistake" candidates are
//                         weighted against each other (see chooseMove() in
//                         bot.service.js: weight = 1 / (loss + softening)).
//                         A low value (e.g. 50) heavily favors near-misses,
//                         so almost every "mistake" ends up being a tiny
//                         inaccuracy - that's fine for Hard, but it's why
//                         Easy/Medium previously still felt strong even with
//                         a high mistakeChance: the mistakes they *did* make
//                         were rarely real blunders. A high value flattens
//                         the distribution so genuinely bad moves (hung
//                         pieces, missed tactics) become plausible, not just
//                         theoretical.
//   - mistakesOnlyWhenComplex / complexityThreshold:
//                         if set, a tier only rolls for a mistake when the
//                         position is "close" - i.e. the gap between the
//                         engine's best and second-best candidate is under
//                         complexityThreshold centipawns. A big gap means
//                         there's one clearly-correct move (a hanging piece,
//                         a forced tactic), so a strong bot wouldn't
//                         plausibly miss it; a small gap means the position
//                         is genuinely unclear, which is exactly where a
//                         strong human can slip. Used for Extreme to give it
//                         a "human mind" - rare mistakes, but only in messy,
//                         hard-to-read positions, never in clear-cut ones.
//
// This produces the intended gradient:
//   Very Easy / Easy   -> shallow search, errs often, and errors are
//                          frequently severe (hangs pieces, misses simple
//                          tactics) rather than just slightly imprecise.
//   Medium             -> shallow-ish search, errs somewhat often, mistakes
//                          are moderate but no longer just near-misses.
//   Hard               -> mostly sound, occasional small inaccuracy.
//   Extreme            -> nearly always correct, full-strength search; the
//                          rare slip only happens in genuinely complex,
//                          unclear positions - never a missed one-mover.
//   Invincible         -> unrestricted full-strength engine play, no
//                          artificial mistakes at all (multiPV 1).

export const BOT_DIFFICULTIES = [
  {
    key: "very_easy",
    label: "Very Easy",
    elo: 200,
    depth: 4,
    multiPV: 8,
    mistakeChance: 0.85,
    maxCentipawnLoss: 1500,
    mistakeSoftening: 500,
  },
  {
    key: "easy",
    label: "Easy",
    elo: 800,
    depth: 7,
    multiPV: 6,
    mistakeChance: 0.5,
    maxCentipawnLoss: 600,
    mistakeSoftening: 250,
  },
  {
    key: "medium",
    label: "Medium",
    elo: 1400,
    depth: 9,
    multiPV: 5,
    mistakeChance: 0.35,
    maxCentipawnLoss: 350,
    mistakeSoftening: 150,
  },
  {
    key: "hard",
    label: "Hard",
    elo: 2000,
    depth: 11,
    multiPV: 5,
    mistakeChance: 0.25,
    maxCentipawnLoss: 200,
    mistakeSoftening: 110,
  },
  {
    key: "extreme",
    label: "Extreme",
    elo: 2700,
    depth: 16,
    multiPV: 4,
    mistakeChance: 0.13,
    maxCentipawnLoss: 100,
    mistakeSoftening: 70,
    mistakesOnlyWhenComplex: true,
    complexityThreshold: 90,
  },
  {
    key: "invincible",
    label: "Invincible",
    elo: 3600,
    depth: 22,
    multiPV: 2,
    mistakeChance: 0.04,
    maxCentipawnLoss: 30,
    mistakeSoftening: 50,
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