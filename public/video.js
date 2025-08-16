const socket = io();

// get DOM elements
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const toggleCameraBtn = document.getElementById("toggleCamera");
const toggleMicBtn = document.getElementById("toggleMic");
const endCallBtn = document.getElementById("endCall");

const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");

const docUpload = document.getElementById("docUpload");
const uploadBtn = document.getElementById("uploadBtn");
const uploadedList = document.getElementById("uploadedList");

// --- WebRTC setup ---
let localStream;
let peerConnection;
const room = "room1"; // demo: you can replace with appointmentId from DB
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// ask for camera + mic
async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    joinRoom();
  } catch (err) {
    alert("❌ Camera/Mic permission denied. Please allow access.");
    console.error(err);
  }
}

function joinRoom() {
  socket.emit("join", { room, role: "patient" });

  peerConnection = new RTCPeerConnection(config);

  // push local tracks
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  // remote stream
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  // ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { room, candidate: event.candidate });
    }
  };
}

// --- signaling handlers ---
socket.on("offer", async ({ from, sdp }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", { room, sdp: answer });
});

socket.on("answer", async ({ from, sdp }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on("ice-candidate", async ({ from, candidate }) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("ICE error", err);
  }
});

// --- Chat ---
sendBtn.onclick = () => {
  const msg = chatInput.value;
  if (!msg) return;
  socket.emit("chat", { room, message: msg, name: "Patient", ts: Date.now() });
  chatInput.value = "";
};

socket.on("chat", ({ message, name, ts }) => {
  const el = document.createElement("p");
  el.textContent = `${name}: ${message}`;
  messages.appendChild(el);
});

// --- Upload docs (just frontend simulation) ---
uploadBtn.onclick = () => {
  const file = docUpload.files[0];
  if (!file) return alert("Select a file first!");

  const el = document.createElement("p");
  el.textContent = `Uploaded: ${file.name}`;
  uploadedList.appendChild(el);
};

// --- Controls ---
toggleCameraBtn.onclick = () => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  toggleCameraBtn.textContent = videoTrack.enabled ? "Turn Off Camera" : "Turn On Camera";
};

toggleMicBtn.onclick = () => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  toggleMicBtn.textContent = audioTrack.enabled ? "Mute Mic" : "Unmute Mic";
};

endCallBtn.onclick = () => {
  socket.emit("leave", { room });
  peerConnection.close();
  window.location.href = "/";
};

// init on load
initMedia();
