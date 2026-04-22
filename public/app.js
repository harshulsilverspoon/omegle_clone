const socket = io();

const localVideo   = document.getElementById('localVideo');
const remoteVideo  = document.getElementById('remoteVideo');
const waitingOverlay = document.getElementById('waitingOverlay');
const statusText   = document.getElementById('statusText');
const startBtn     = document.getElementById('startBtn');
const skipBtn      = document.getElementById('skipBtn');
const stopBtn      = document.getElementById('stopBtn');

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

let localStream = null;
let pc = null;  // RTCPeerConnection
let active = false;

// ── UI helpers ────────────────────────────────────────────────────────────────

function setStatus(msg) {
  statusText.textContent = msg;
}

function showOverlay(msg) {
  waitingOverlay.classList.remove('hidden');
  setStatus(msg);
}

function hideOverlay() {
  waitingOverlay.classList.add('hidden');
}

function setButtons(state) {
  // states: 'idle' | 'waiting' | 'chatting'
  startBtn.disabled = state !== 'idle';
  skipBtn.disabled  = state !== 'chatting';
  stopBtn.disabled  = state === 'idle';
}

// ── WebRTC ────────────────────────────────────────────────────────────────────

function createPeerConnection() {
  if (pc) {
    pc.close();
    pc = null;
  }

  pc = new RTCPeerConnection(ICE_SERVERS);

  // Add local tracks
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  // Relay ICE candidates
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit('ice-candidate', candidate);
  };

  // Receive remote stream
  pc.ontrack = ({ streams }) => {
    remoteVideo.srcObject = streams[0];
    hideOverlay();
    setButtons('chatting');
  };

  pc.onconnectionstatechange = () => {
    if (pc && (pc.connectionState === 'disconnected' || pc.connectionState === 'failed')) {
      showOverlay('Connection lost. Looking for someone new…');
      setButtons('waiting');
      socket.emit('skip');
    }
  };
}

async function startAsOfferer() {
  createPeerConnection();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', offer);
}

async function handleOffer(offer) {
  createPeerConnection();
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', answer);
}

// ── Socket events ─────────────────────────────────────────────────────────────

socket.on('matched', async ({ isOfferer }) => {  // ← CHANGED FROM 'role' TO 'isOfferer'
  console.log('Matched! isOfferer:', isOfferer);
  showOverlay('Connecting…');
  if (isOfferer) {
    await startAsOfferer();
  }
  // answerer waits for the offer
});

socket.on('offer', handleOffer);

socket.on('answer', async (answer) => {
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async (candidate) => {
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (_) {}
  }
});

socket.on('partnerLeft', () => {  // ← CHANGED FROM 'peer_left'
  remoteVideo.srcObject = null;
  if (active) {
    showOverlay('Stranger disconnected. Looking for someone new…');
    setButtons('waiting');
    socket.emit('start');  // ← CHANGED FROM 'join' TO 'start'
  }
});

// ── Button handlers ───────────────────────────────────────────────────────────

startBtn.addEventListener('click', async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    active = true;
    showOverlay('Looking for someone…');
    setButtons('waiting');
    socket.emit('start');  // ← CHANGED FROM 'join' TO 'start'
  } catch (err) {
    alert('Could not access camera/microphone: ' + err.message);
  }
});

skipBtn.addEventListener('click', () => {
  remoteVideo.srcObject = null;
  showOverlay('Looking for someone…');
  setButtons('waiting');
  socket.emit('skip');
});

stopBtn.addEventListener('click', () => {
  active = false;
  remoteVideo.srcObject = null;

  if (pc) { pc.close(); pc = null; }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
    localVideo.srcObject = null;
  }

  socket.emit('skip'); // remove from queue/pair
  showOverlay('Press Start to begin');
  setButtons('idle');
});
