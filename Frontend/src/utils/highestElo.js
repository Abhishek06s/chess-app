/**
 * Given a user's `stats` object ({ bullet, blitz, rapid }, each with a
 * `.rating`), returns the highest rating across all three modes. Returns
 * `null` if no valid rating is found (e.g. stats missing/not populated).
 */
export const getHighestElo = (stats) => {
  if (!stats) return null;

  const ratings = ["bullet", "blitz", "rapid"]
    .map((mode) => stats?.[mode]?.rating)
    .filter((rating) => typeof rating === "number" && !Number.isNaN(rating));

  if (ratings.length === 0) return null;

  return Math.max(...ratings);
};
