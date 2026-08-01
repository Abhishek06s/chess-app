import api from "./api.service";

export const getProfile = async () => {
  const response = await api.get("/users/profile");

  return response.data;
};

export const getUserByUsername = async (username) => {
  const response = await api.get(`/users/profile/${username}`);

  return response.data;
};

export const getLeaderboard = async (mode) => {
  const response = await api.get(`/users/leaderboard?mode=${mode}`);

  return response.data;
};

export const searchUsers = async (query) => {
  const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);

  return response.data;
};

export const getPendingRequests = async () => {
  const response = await api.get("/users/friends/requests");

  return response.data;
};

export const sendFriendRequest = async (userId) => {
  const response = await api.post(`/users/friends/request/${userId}`);

  return response.data;
};

export const acceptFriendRequest = async (userId) => {
  const response = await api.post(`/users/friends/accept/${userId}`);

  return response.data;
};

export const rejectFriendRequest = async (userId) => {
  const response = await api.post(`/users/friends/reject/${userId}`);

  return response.data;
};

export const removeFriend = async (userId) => {
  const response = await api.delete(`/users/friends/${userId}`);

  return response.data;
};