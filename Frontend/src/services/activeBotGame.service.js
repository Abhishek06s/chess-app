import api from "./api.service";

export const getActiveBotGame = async () => {
  const response = await api.get("/bot-games");
  return response.data;
};

export const saveActiveBotGame = async ({ fen, moves, playerColor }) => {
  const response = await api.put("/bot-games", { fen, moves, playerColor });
  return response.data;
};

export const deleteActiveBotGame = async () => {
  const response = await api.delete("/bot-games");
  return response.data;
};
