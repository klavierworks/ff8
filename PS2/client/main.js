const SERVER_HOST = "192.168.2.20";
const SERVER_PORT = 8081;
const font = new Font("default");
const log = (message, ...args) => {
 // if (typeof message !== "string") return;
 // const file = std.open("log.log", "a");
 // if (!file) return;
 // const messageWithNewline = message + " " + args.join(" ") + "\n";
 // const length = messageWithNewline.length;
 // const arrayBuffer = new ArrayBuffer(length);
 // const byteView = new Uint8Array(arrayBuffer);
 // for (let i = 0; i < length; i++) {
 //   byteView[i] = messageWithNewline.charCodeAt(i) & 0xff;
 // }
 // file.write(arrayBuffer, 0, length);
 // file.close();
};
Screen.setParam(Screen.DEPTH_TEST_ENABLE, false);
Screen.setFrameCounter(true);
const connectToServer = () => {
  IOP.reset();
  IOP.loadModule("padman");
  IOP.loadModule("SMAP");
  Network.init();
  log("Connecting to server at", SERVER_HOST, SERVER_PORT);
  const socket = new Socket(Socket.AF_INET, Socket.SOCK_STREAM);
  socket.connect(SERVER_HOST, SERVER_PORT);
  log("Connected to server");
  return socket;
};
const socket = connectToServer();
const ACK = (() => {
  const buf = new ArrayBuffer(4);
  const view = new Uint8Array(buf);
  view[0] = 0x41;
  view[1] = 0x43;
  view[2] = 0x4b;
  view[3] = 0x0a;
  return buf;
})();
const HEADER_SIZE = 4;
const getFrameSize = () => {
  const frameSizeHeaderBuffer = socket.recv(HEADER_SIZE, true);
  const frameSizeHeader = new Uint8Array(frameSizeHeaderBuffer);
  return (
    (frameSizeHeader[0] << 24) |
    (frameSizeHeader[1] << 16) |
    (frameSizeHeader[2] << 8) |
    frameSizeHeader[3]
  );
};
let currentImage = null;
let imageToFree = null;
let isFetchingFrame = false;
const recvFull = (size) => {
  const buf = new ArrayBuffer(size);
  if (buf.byteLength !== size) {
    log("recvFull: allocation failed for size", size);
    return null;
  }
  const view = new Uint8Array(buf);
  let received = 0;
  while (received < size) {
    const chunk = socket.recv(size - received, true);
    if (!chunk || chunk.byteLength === 0) {
      log("recvFull: got empty chunk, aborting");
      return null;
    }
    const chunkView = new Uint8Array(chunk);
    view.set(chunkView, received);
    received += chunk.byteLength;
  }
  return buf;
};
const requestThread = new Thread(() => {
  isFetchingFrame = true;
  log("thread: sending ACK");
  socket.send(ACK);
  log("thread: getting frame size");
  const frameSize = getFrameSize();
  if (frameSize <= 0) {
    log("thread: invalid frame size", frameSize);
    isFetchingFrame = false;
    return;
  }
  log("thread: receiving frame", frameSize, "bytes");
  const frameBuffer = recvFull(frameSize);
  if (!frameBuffer) {
    log("thread: recvFull failed");
    isFetchingFrame = false;
    return;
  }
  log("thread: decoding jpeg");
  const newImage = Image.fromJpeg(frameBuffer);
  log("thread: swapping image");
  const oldImage = currentImage;
  currentImage = newImage;
  currentImage.width = 640;
  currentImage.height = 480;
  imageToFree = oldImage;
  log("thread: done");
  isFetchingFrame = false;
}, "RequestThread");
Screen.display(() => {
  if (!isFetchingFrame) {
    log("display: starting request thread");
    requestThread.start();
    log("display: request thread started");
  }
  if (currentImage) {
    log("display: drawing");
    currentImage.draw(0, 0);
    log("display: drawn");
  }
  if (imageToFree) {
    log("display: freeing old image");
    imageToFree.free();
    imageToFree = null;
    log("display: freed");
  }
  const stats = System.getMemoryStats();
  font.print(0, 0, "RAM allocs: " + stats.allocs + " used: " + stats.used);
  font.print(40, 40, "Random number: " + Math.random());
});