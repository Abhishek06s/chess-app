const Q = Math.log(10) / 400; 
const MIN_RATING = 100;
const MIN_RD = 30; 

const calculateG = (rd) => {
  return 1 / Math.sqrt(1 + (3 * Math.pow(Q, 2) * Math.pow(rd, 2)) / Math.pow(Math.PI, 2));
};

const getExpectedScore = (playerRating, opponentRating, opponentRD) => {
  const gOpp = calculateG(opponentRD);
  return 1 / (1 + Math.pow(10, (-gOpp * (playerRating - opponentRating)) / 400));
};

const calculateNewRating = (
  playerRating,
  playerRD,
  opponentRating,
  opponentRD,
  actualScore 
) => {
  const expected = getExpectedScore(playerRating, opponentRating, opponentRD);
  const gOpp = calculateG(opponentRD);

  
  const varianceD2 = 1 / (Math.pow(Q, 2) * Math.pow(gOpp, 2) * expected * (1 - expected));

  
  const kFactorEquivalent = Q / (1 / Math.pow(playerRD, 2) + 1 / varianceD2);
  const newRating = playerRating + kFactorEquivalent * gOpp * (actualScore - expected);

  
  const newRD = Math.sqrt(1 / (1 / Math.pow(playerRD, 2) + 1 / varianceD2));

  return {
    rating: Math.max(MIN_RATING, Math.round(newRating)),
    rd: Math.max(MIN_RD, newRD) 
  };
};

module.exports = {
  calculateNewRating,
};