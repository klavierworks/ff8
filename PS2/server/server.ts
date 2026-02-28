// server.ts
// Combined HTTP + WebSocket + TCP streaming server
//
// Endpoints:
//   HTTP preview page:        http://localhost:8080/preview
//   WebSocket ingest:         ws://localhost:8080/ingest
//   WebSocket preview view:   ws://localhost:8080/view
//   TCP raw stream (PS2):     tcp://localhost:9090

import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import {
  createServer as createTcpServer,
  type Socket as TcpSocket,
} from "node:net";

import { WebSocketServer, type WebSocket } from "ws";

const httpPort = 8080;
const tcpPort = 9090;
const TCP_CHUNK_SIZE = 10450;

/* -------------------------------------------------------------------------- */
/* Utility Logging                                                            */
/* -------------------------------------------------------------------------- */

const getRemoteAddress = (socket: { remoteAddress?: string; remotePort?: number }) => {
  const address = socket.remoteAddress ?? "unknown-address";
  const port = socket.remotePort ?? 0;
  return `${address}:${port}`;
};

const logConnection = (
  type: string,
  remote: string,
  extra: string | null = null,
) => {
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

      const protocol = location.protocol === "https:" ? "wss" : "ws";
      const socketUrl = \`\${protocol}://\${location.host}/view\`;

      const socket = new WebSocket(socketUrl);
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

          if (buffer.length < 4 + length) {
            return;
          }

          const jpegBytes = buffer.subarray(4, 4 + length);
          buffer = buffer.subarray(4 + length);

          const blob = new Blob([jpegBytes], { type: "image/jpeg" });
          const bitmap = await createImageBitmap(blob);

          if (latestBitmap) {
            latestBitmap.close();
          }

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

const httpServer = createHttpServer(
  (request: IncomingMessage, response: ServerResponse) => {
    const url = request.url ?? "/";

    if (url === "/" || url === "/preview") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(previewHtml);
      return;
    }

    response.statusCode = 404;
    response.end("Not Found");
  },
);

/* -------------------------------------------------------------------------- */
/* WebSocket Servers                                                          */
/* -------------------------------------------------------------------------- */

const ingestWebSocketServer = new WebSocketServer({ noServer: true });
const viewWebSocketServer = new WebSocketServer({ noServer: true });

const viewClients = new Set<WebSocket>();

/* -------------------------------------------------------------------------- */
/* TCP Client State                                                           */
/* -------------------------------------------------------------------------- */

type TcpClientState = {
  ready: boolean;
  incomingBuffer: string;
  pendingChunks: string[];
};

const tcpClientStates = new Map<TcpSocket, TcpClientState>();

/* -------------------------------------------------------------------------- */
/* Broadcast Helpers                                                          */
/* -------------------------------------------------------------------------- */

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

const sendNextChunk = (client: TcpSocket, state: TcpClientState) => {
  if (client.destroyed) {
    tcpClientStates.delete(client);
    return;
  }
  if (state.pendingChunks.length === 0) return;

  const chunk = state.pendingChunks.shift()!;
  console.log(
    `Sending chunk, ${chunk.length} bytes, ${state.pendingChunks.length} remaining`
  );
  client.write(chunk);
};

const broadcastToTcpClients = (buffer: Buffer) => {
  tcpClientStates.forEach((state, client) => {
    if (client.destroyed) {
      tcpClientStates.delete(client);
      return;
    }
    if (!state.ready) {
      console.log("TCP client not ready, skipping frame");
      return;
    }

    const message = buffer.toString("base64") + "|";
    console.log("Queuing frame for TCP client, total length:", message.length);

    // Split into chunks
    state.pendingChunks = [];
    for (let i = 0; i < message.length; i += TCP_CHUNK_SIZE) {
      state.pendingChunks.push(message.slice(i, i + TCP_CHUNK_SIZE));
    }

    state.ready = false;
    sendNextChunk(client, state);
  });
};
/* -------------------------------------------------------------------------- */
/* WebSocket Ingest                                                           */
/* -------------------------------------------------------------------------- */

ingestWebSocketServer.on("connection", (socket, request) => {
  const remote = getRemoteAddress(request.socket);
  const userAgent = request.headers["user-agent"] ?? "unknown-user-agent";

  logConnection("WebSocket Ingest", remote, `UA=${userAgent}`);

  let ingestBuffer = Buffer.alloc(0);

  socket.on("message", (data) => {
    if (typeof data === "string") return;

    ingestBuffer = Buffer.concat([ingestBuffer, Buffer.from(data as Buffer)]);

    while (ingestBuffer.length >= 4) {
      const frameLength = ingestBuffer.readUInt32BE(0);

      if (ingestBuffer.length < 4 + frameLength) break;

      const completeFrame = ingestBuffer.subarray(0, 4 + frameLength);
      ingestBuffer = ingestBuffer.subarray(4 + frameLength);

      if (completeFrame.length < 30000) continue;

      broadcastToViewClients(completeFrame);
      broadcastToTcpClients(completeFrame);
    }
  });

  socket.on("close", () => {
    logDisconnection("WebSocket Ingest", remote);
  });
});

/* -------------------------------------------------------------------------- */
/* WebSocket Preview                                                          */
/* -------------------------------------------------------------------------- */

viewWebSocketServer.on("connection", (socket, request) => {
  const remote = getRemoteAddress(request.socket);
  const userAgent = request.headers["user-agent"] ?? "unknown-user-agent";

  logConnection("WebSocket Preview", remote, `UA=${userAgent}`);

  viewClients.add(socket);

  socket.on("close", () => {
    viewClients.delete(socket);
    logDisconnection("WebSocket Preview", remote);
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
/* TCP Server                                                                 */
/* -------------------------------------------------------------------------- */

const tcpServer = createTcpServer((socket) => {
  const remote = getRemoteAddress(socket);

  logConnection("TCP Stream Client", remote);

  tcpClientStates.set(socket, { ready: true, incomingBuffer: "" });
socket.on("data", (chunk) => {
  const state = tcpClientStates.get(socket);
  if (!state) return;

  state.incomingBuffer += chunk.toString();

  if (!state.incomingBuffer.includes("ACK")) return;
  state.incomingBuffer = "";

  if (state.pendingChunks.length > 0) {
    // More chunks to send for current frame
    sendNextChunk(socket, state);
  } else {
    // All chunks sent, ready for next frame
    console.log("TCP client ready for next frame");
    state.ready = true;
  }
});

  socket.on("close", () => {
    tcpClientStates.delete(socket);
    logDisconnection("TCP Stream Client", remote);
  });

  socket.on("error", () => {
    tcpClientStates.delete(socket);
    logDisconnection("TCP Stream Client", remote);
  });
});

/* -------------------------------------------------------------------------- */
/* Start Servers                                                              */
/* -------------------------------------------------------------------------- */

httpServer.listen(httpPort, () => {
  console.log(`HTTP preview: http://localhost:${httpPort}/preview`);
  console.log(`WebSocket ingest: ws://localhost:${httpPort}/ingest`);
  console.log(`WebSocket preview: ws://localhost:${httpPort}/view`);
});

tcpServer.listen(tcpPort, () => {
  console.log(`TCP stream server listening on port ${tcpPort}`);
});