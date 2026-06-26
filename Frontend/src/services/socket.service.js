import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const sanitizedUrl = BACKEND_URL.replace(/\/+$/, ""); 

export const socket = io(sanitizedUrl, {
  withCredentials: true,
  autoConnect: true,
});