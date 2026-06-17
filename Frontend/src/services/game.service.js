import api from "./api.service";

export const getMyGames = async () => {
  const response = await api.get("/games/my-games");

  return response.data;
};

export const getGameById = async (id) => {
  const response = await api.get(`/games/${id}`);

  return response.data;
};

export const createGame = async (gameData) => {
  const response = await api.post("/games", gameData);

  return response.data;
};

export const deleteGame = async (id) => {
  const response = await api.delete(`/games/${id}`);

  return response.data;
};