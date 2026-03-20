import { io } from "socket.io-client";

const WS_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

let socketSingleton;

export const connectSocket = () => {
  if (socketSingleton) return socketSingleton;

  socketSingleton = io(WS_URL, {
    transports: ["websocket"],
  });

  return socketSingleton;
};

