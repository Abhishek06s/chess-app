export const generateGuestUser = () => {
  return {
    username: `guest_player_${Math.floor(
      100000 + Math.random() * 900000
    )}`,

    isGuest: true,

    stats: {
      bullet: {
        rating: 1500,
      },

      blitz: {
        rating: 1500,
      },

      rapid: {
        rating: 1500,
      },
    },
  };
};