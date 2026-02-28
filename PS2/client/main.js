const SERVER_HOST = "192.168.2.20";
const SERVER_PORT = 9090;
let currentFrame;
const font = new Font("default");

const log = (message, ...args) => {
  if (typeof message !== "string") return;
  const file = std.open("log.log", "a");
  if (!file) return;
  const messageWithNewline = message + " " + args.join(" ") + "\n";
  const length = messageWithNewline.length;
  const arrayBuffer = new ArrayBuffer(length);
  const byteView = new Uint8Array(arrayBuffer);
  for (let i = 0; i < length; i++) {
    byteView[i] = messageWithNewline.charCodeAt(i) & 0xff;
  }
  file.write(arrayBuffer, 0, length);
  file.close();
};

Screen.setParam(Screen.DEPTH_TEST_ENABLE, false);
Screen.setFrameCounter(true);

const draw = () => {
  if (currentFrame) {
    currentFrame.draw(0.0, 0.0);
  } else {
    font.print(0, 0, "Waiting for server...");
  }
};

const FRAME_FILE_PATH = "stream.jpg";
const RECEIVE_CHUNK_SIZE = 1450;

function base64ToUint8Array(base64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  const len = base64.length;
  let bufLen = Math.floor(len * 3 / 4);
  if (base64[len - 1] === '=') bufLen--;
  if (base64[len - 2] === '=') bufLen--;
  const output = new Uint8Array(bufLen);
  let i = 0, j = 0;
  while (i < len) {
    const a = lookup[base64.charCodeAt(i++)];
    const b = lookup[base64.charCodeAt(i++)];
    const c = lookup[base64.charCodeAt(i++)];
    const d = lookup[base64.charCodeAt(i++)];
    output[j++] = (a << 2) | (b >> 4);
    if (j < bufLen) output[j++] = ((b & 0xF) << 4) | (c >> 2);
    if (j < bufLen) output[j++] = ((c & 0x3) << 6) | d;
  }
  return output;
}

const writeWholeFile = (path, byteView) => {
  const flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC;
  const fileDescriptor = os.open(path, flags);
  if (fileDescriptor < 0) {
    throw new Error(`os.open failed: ${fileDescriptor}`);
  }
  const written = os.write(fileDescriptor, byteView.buffer, byteView.byteOffset, byteView.byteLength);
  os.close(fileDescriptor);
  if (written !== byteView.byteLength) {
    throw new Error(`os.write short: ${written}/${byteView.byteLength}`);
  }
};

const connectToServer = () => {
  IOP.reset();
  IOP.loadModule("padman");
  IOP.loadModule("SMAP");
  Network.init();
  log("Connecting to server at", SERVER_HOST, SERVER_PORT);
  const socket = new Socket(Socket.AF_INET, Socket.SOCK_STREAM);
  socket.connect(SERVER_HOST, SERVER_PORT);
  log("Connected to server at", SERVER_HOST, SERVER_PORT);
  return socket;
};

const socket = connectToServer();

let receiveBuffer = "";

const poll = () => {
  const chunk = socket.recv(RECEIVE_CHUNK_SIZE);
  if (!chunk || chunk.length === 0) return;

  receiveBuffer += chunk;
  log("Got chunk, size:", chunk.length, "buffer size:", receiveBuffer.length);
log(receiveBuffer)
  const delimiterIndex = receiveBuffer.indexOf("|");
  log("Delimiter index:", delimiterIndex);
  if (delimiterIndex === -1) {
    // Mid-frame chunk, request next
    socket.send("ACK");
    return;
  }

  // Complete frame
  log("Got complete frame, base64 length:", delimiterIndex);
  const base64 = receiveBuffer.substring(0, delimiterIndex);
  receiveBuffer = "";

  try {
    const jpegBytes = base64ToUint8Array(base64);
    writeWholeFile(FRAME_FILE_PATH, jpegBytes);
    currentFrame = new Bitmap(FRAME_FILE_PATH);
    log("Frame loaded successfully");
  } catch (e) {
    log("Error processing frame:", e.message);
  }

  // Ready for next frame
  socket.send("ACK");
};

Screen.display(() => {
  draw();
  poll();
});