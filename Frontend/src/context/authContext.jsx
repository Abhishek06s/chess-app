import React, { createContext, useContext, useEffect, useState } from "react";
import { getProfile } from "../services/user.service";
import { socket } from "../services/socket.service";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await getProfile();
      setUser(res.user);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (userData) => {
    try {
      const res = await getProfile();
      setUser(res.user);
      socket.disconnect();
      socket.connect();
    } catch (err) {
      console.error("Failed to fetch full profile details on login:", err);
    }
  };

  const logout = async (logoutApiCall) => {
    try {
      await logoutApiCall();
      setUser(null);
    } catch (err) {
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
