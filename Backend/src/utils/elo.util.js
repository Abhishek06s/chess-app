const getKFactor = (gamesPlayed) => {
  if (gamesPlayed < 10) return 40;
  if (gamesPlayed < 20) return 30;
  if (gamesPlayed < 30) return 20;

  return 16;
};

const getExpectedScore = (playerRating, opponentRating) => {
  return 1 / (
    1 + Math.pow(10, (opponentRating - playerRating) / 400)
  );
};

const calculateNewRating = (
  playerRating,
  opponentRating,
  actualScore,
  gamesPlayed,
) => {
  const expected = getExpectedScore(
    playerRating,
    opponentRating,
  );

  const kFactor = getKFactor(gamesPlayed);

  return Math.round(
    playerRating +
      kFactor * (actualScore - expected),
  );
};

module.exports = {
  calculateNewRating,
};