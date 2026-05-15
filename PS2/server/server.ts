import { createServer as createHttpServer } from "node:http";
import { createServer as createTcpServer, type Socket as TcpSocket } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

const httpPort = 8080;
const tcpPort = 8081;
const TCP_CHUNK_SIZE = 512;

/* -------------------------------------------------------------------------- */
/* Utility Logging                                                            */
/* -------------------------------------------------------------------------- */

const getRemoteAddress = (socket: { remoteAddress?: string; remotePort?: number }) => {
  const address = socket.remoteAddress ?? "unknown-address";
  const port = socket.remotePort ?? 0;
  return `${address}:${port}`;
};

const logConnection = (type: string, remote: string, extra: string | null = null) => {
  const timestamp = new Date().toISOString();
  const message = extra
    ? `[${timestamp}] CONNECT ${type} ${remote} ${extra}`
    : `[${timestamp}] CONNECT ${type} ${remote}`;
  console.log(message);
};

const logDisconnection = (type: string, remote: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] DISCONNECT ${type} ${remote}`);
};

/* -------------------------------------------------------------------------- */
/* HTTP Preview Page                                                          */
/* -------------------------------------------------------------------------- */

const previewHtml = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>JPEG Stream Preview</title>
    <style>
      html, body {
        margin: 0;
        height: 100%;
        background: #000;
        display: grid;
        place-items: center;
      }
      canvas { image-rendering: pixelated; }
      #overlay {
        position: fixed;
        top: 12px;
        left: 12px;
        color: #00ff00;
        font: 12px monospace;
        background: rgba(0,0,0,0.6);
        padding: 8px 10px;
        border-radius: 8px;
        white-space: pre;
      }
    </style>
  </head>
  <body>
    <div id="overlay">connecting…</div>
    <canvas id="screen" width="640" height="480"></canvas>

    <script type="module">
      const overlay = document.getElementById("overlay");
      const canvas = document.getElementById("screen");
      const context = canvas.getContext("2d");

      const socket = new WebSocket(\`ws://\${location.host}/view\`);
      socket.binaryType = "arraybuffer";

      let buffer = new Uint8Array(0);
      let latestBitmap = null;

      const append = (existing, incoming) => {
        const merged = new Uint8Array(existing.length + incoming.length);
        merged.set(existing);
        merged.set(incoming, existing.length);
        return merged;
      };

      const readUint32BE = (bytes) => {
        return (((bytes[0] << 24) | (bytes[1] << 16) |
                 (bytes[2] << 8) | bytes[3]) >>> 0);
      };

      socket.onmessage = async (event) => {
        const incoming = new Uint8Array(event.data);
        buffer = append(buffer, incoming);

        while (buffer.length >= 4) {
          const length = readUint32BE(buffer);
          if (buffer.length < 4 + length) return;

          const jpegBytes = buffer.subarray(4, 4 + length);
          buffer = buffer.subarray(4 + length);

          const blob = new Blob([jpegBytes], { type: "image/jpeg" });
          const bitmap = await createImageBitmap(blob);
          if (latestBitmap) latestBitmap.close();
          latestBitmap = bitmap;
        }
      };

      const draw = () => {
        if (latestBitmap) {
          context.drawImage(latestBitmap, 0, 0, canvas.width, canvas.height);
        }
        requestAnimationFrame(draw);
      };

      draw();
    </script>
  </body>
</html>
`;

/* -------------------------------------------------------------------------- */
/* HTTP Server                                                                */
/* -------------------------------------------------------------------------- */

const httpServer = createHttpServer((request: IncomingMessage, response: ServerResponse) => {
  const url = request.url ?? "/";

  if (url === "/" || url === "/preview") {
    response.statusCode = 200;
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(previewHtml);
    return;
  }

  response.statusCode = 404;
  response.end("Not Found");
});

/* -------------------------------------------------------------------------- */
/* Shared State                                                               */
/* -------------------------------------------------------------------------- */

const viewClients = new Set<WebSocket>();
const pendingTcpSenders = new Set<() => void>();

let latestFrame: Buffer | null = null;
let latestFrameId = 0;

const broadcastToViewClients = (buffer: Buffer) => {
  viewClients.forEach((client) => {
    if (client.readyState !== client.OPEN) {
      viewClients.delete(client);
      return;
    }
    console.log("Broadcasting to view client", buffer.length, "bytes");
    client.send(buffer);
  });
};

const encodeU32BE = (value: number): Buffer => {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value, 0);
  return buf;
};

const writeFrameToTcpSocket = (socket: TcpSocket, frame: Buffer) => {
  const header = encodeU32BE(frame.length);
  const packet = Buffer.concat([header, frame]);
  console.log(`[TCP] Writing frame: ${packet.length} bytes (${frame.length} payload)`);
  const flushed = socket.write(packet);
  if (!flushed) {
    console.log(`[TCP] Write buffer full, waiting for drain`);
    socket.once("drain", () => {
      console.log(`[TCP] Drained`);
    });
  }
};

/* -------------------------------------------------------------------------- */
/* WebSocket Servers                                                          */
/* -------------------------------------------------------------------------- */

const ingestWebSocketServer = new WebSocketServer({ noServer: true });
const viewWebSocketServer = new WebSocketServer({ noServer: true });

ingestWebSocketServer.on("connection", (socket, request) => {
  const remote = getRemoteAddress(request.socket);
  const userAgent = request.headers["user-agent"] ?? "unknown-user-agent";
  logConnection("WebSocket Ingest", remote, `UA=${userAgent}`);

  socket.on("message", (data) => {
    if (typeof data === "string") return;
    const newData = Buffer.from(data as Buffer);

    latestFrame = newData;
    latestFrameId++;
    broadcastToViewClients(latestFrame);
    pendingTcpSenders.forEach((flush) => flush());
  });

  socket.on("close", () => {
    logDisconnection("WebSocket Ingest", remote);
  });
});

viewWebSocketServer.on("connection", (socket, request) => {
  const remote = getRemoteAddress(request.socket);
  const userAgent = request.headers["user-agent"] ?? "unknown-user-agent";
  logConnection("WebSocket View", remote, `UA=${userAgent}`);

  viewClients.add(socket);

  socket.on("close", () => {
    viewClients.delete(socket);
    logDisconnection("WebSocket View", remote);
  });
});

httpServer.on("upgrade", (request, socket, head) => {
  const url = request.url ?? "";

  if (url === "/ingest") {
    ingestWebSocketServer.handleUpgrade(request, socket, head, (ws) => {
      ingestWebSocketServer.emit("connection", ws, request);
    });
    return;
  }

  if (url === "/view") {
    viewWebSocketServer.handleUpgrade(request, socket, head, (ws) => {
      viewWebSocketServer.emit("connection", ws, request);
    });
    return;
  }

  socket.destroy();
});

/* -------------------------------------------------------------------------- */
/* TCP Output Server                                                          */
/* -------------------------------------------------------------------------- */

const tcpServer = createTcpServer((socket: TcpSocket) => {
  const remote = getRemoteAddress(socket);
  logConnection("TCP View", remote);

  let ackBuffer = "";
  let pendingAck = false;
  let lastSentFrameId = -1;

  const trySendFrame = () => {
    if (!latestFrame || latestFrameId === lastSentFrameId) {
      pendingAck = true;
      return;
    }
    pendingAck = false;
    lastSentFrameId = latestFrameId;
    writeFrameToTcpSocket(socket, latestFrame);
  };

  const tryFlush = () => {
    if (pendingAck) trySendFrame();
  };

  pendingTcpSenders.add(tryFlush);

  socket.on("data", (chunk: Buffer) => {
    ackBuffer += chunk.toString("ascii");
    while (ackBuffer.includes("\n")) {
      const idx = ackBuffer.indexOf("\n");
      const line = ackBuffer.slice(0, idx).trim();
      ackBuffer = ackBuffer.slice(idx + 1);
      if (line === "ACK") {
        console.log(`[TCP] Received ACK from ${remote}`);
        trySendFrame();
      } else {
        console.log(`[TCP] Unexpected data from ${remote}: ${line}`);
      }
    }
  });

  socket.on("close", () => {
    pendingTcpSenders.delete(tryFlush);
    logDisconnection("TCP View", remote);
  });

  socket.on("error", (err) => {
    console.error(`TCP error from ${remote}:`, err.message);
    pendingTcpSenders.delete(tryFlush);
  });
});

/* -------------------------------------------------------------------------- */
/* Start Servers                                                              */
/* -------------------------------------------------------------------------- */

httpServer.listen(httpPort, () => {
  console.log(`HTTP preview:     http://localhost:${httpPort}/preview`);
  console.log(`WebSocket ingest: ws://localhost:${httpPort}/ingest`);
  console.log(`WebSocket view:   ws://localhost:${httpPort}/view`);
});

tcpServer.listen(tcpPort, () => {
  console.log(`TCP view:         tcp://localhost:${tcpPort}`);
});