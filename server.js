const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// waiting: array of socket IDs looking for a partner
// pairs: Map<socketId, partnerSocketId>
const waiting = [];
const pairs = new Map();

function tryMatch() {
  while (waiting.length >= 2) {
    const a = waiting.shift();
    const b = waiting.shift();

    // Verify both sockets are still connected
    if (!io.sockets.sockets.get(a) || !io.sockets.sockets.get(b)) {
      if (io.sockets.sockets.get(a)) waiting.unshift(a);
      if (io.sockets.sockets.get(b)) waiting.unshift(b);
      continue;
    }

    pairs.set(a, b);
    pairs.set(b, a);

    // a is the offerer, b is the answerer
    io.to(a).emit('matched', { role: 'offerer' });
    io.to(b).emit('matched', { role: 'answerer' });
  }
}

function leaveQueue(socketId) {
  const idx = waiting.indexOf(socketId);
  if (idx !== -1) waiting.splice(idx, 1);
}

function disconnectPair(socketId) {
  const partner = pairs.get(socketId);
  pairs.delete(socketId);
  if (partner) {
    pairs.delete(partner);
    io.to(partner).emit('peer_left');
  }
}

io.on('connection', (socket) => {
  // User is ready to be matched
  socket.on('join', () => {
    leaveQueue(socket.id);
    disconnectPair(socket.id);
    waiting.push(socket.id);
    tryMatch();
  });

  // User skips current partner
  socket.on('skip', () => {
    disconnectPair(socket.id);
    waiting.push(socket.id);
    tryMatch();
  });

  // WebRTC signaling relay
  socket.on('offer', (offer) => {
    const partner = pairs.get(socket.id);
    if (partner) io.to(partner).emit('offer', offer);
  });

  socket.on('answer', (answer) => {
    const partner = pairs.get(socket.id);
    if (partner) io.to(partner).emit('answer', answer);
  });

  socket.on('ice-candidate', (candidate) => {
    const partner = pairs.get(socket.id);
    if (partner) io.to(partner).emit('ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    leaveQueue(socket.id);
    disconnectPair(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
