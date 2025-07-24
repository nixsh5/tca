// src/socket.js
import { io } from "socket.io-client";

const socket = io('http://localhost:5000'); // Use your backend URL/port

export default socket;
