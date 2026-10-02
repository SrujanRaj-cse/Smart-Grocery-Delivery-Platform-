import { io } from "socket.io-client";

const WS_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

let socketSingleton;
let connectedToken;

export const connectSocket = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  if (socketSingleton && connectedToken !== token) {
    socketSingleton.disconnect();
    socketSingleton = null;
  }
  if (socketSingleton) return socketSingleton;

  socketSingleton = io(WS_URL, {
    transports: ["websocket"],
    auth: { token },
    autoConnect: false,
  });
  connectedToken = token;
  socketSingleton.connect();
  return socketSingleton;
};

export const disconnectSocket = () => {
  socketSingleton?.disconnect();
  socketSingleton = null;
  connectedToken = null;
};
