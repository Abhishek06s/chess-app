import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return null;

  return user ? <Navigate to="/" replace /> : children;
};

export default GuestRoute;