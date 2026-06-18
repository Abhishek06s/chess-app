import api from "./api.service";

export const getProfile = async () => {
  const response = await api.get("/users/profile");

  return response.data;
};

export const getLeaderboard = async (mode) => {
  const response = await api.get(`/users/leaderboard?mode=${mode}`);

  return response.data;
};