const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  console.log('🔌 [UPLINK_ESTABLISHED]: ' + socket.id);
  socket.on('send_emergency', (data) => {
    io.emit('receive_emergency', data); 
    console.log('📡 [BROADCAST]:', data.type);
  });
});

server.listen(5000, () => console.log('🛰️ SENTINEL BACKEND ONLINE: PORT 5000'));