// useJpegSocketStream.ts
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";

type UseJpegSocketStreamOptions = {
  wsUrl: string;
  fps?: number; // default 15
  jpegQuality?: number; // default 0.7
  maxBufferedBytes?: number; // default 2_000_000
};

const isCanvasBlank = (canvas: HTMLCanvasElement): boolean => {
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) {
    // Fall back to 2d context sample
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const { data } = ctx.getImageData(0, 0, 1, 1);
    return data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 0;
  }

  // Sample a few pixels spread across the canvas
  const samples = [
    [0, 0],
    [canvas.width >> 1, canvas.height >> 1],       // center
    [canvas.width - 1, canvas.height - 1],          // bottom-right
  ];

  const pixel = new Uint8Array(4);
  for (const [x, y] of samples) {
    // WebGL y-axis is flipped
    gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    if (pixel[0] !== 0 || pixel[1] !== 0 || pixel[2] !== 0 || pixel[3] !== 0) {
      return false;
    }
  }

  return true;
};
const encodeU32BE = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);

  bytes[0] = (value >>> 24) & 0xff;
  bytes[1] = (value >>> 16) & 0xff;
  bytes[2] = (value >>> 8) & 0xff;
  bytes[3] = value & 0xff;

  return bytes;
};

const clamp01 = (value: number): number => {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

const createWebSocket = async (wsUrl: string): Promise<WebSocket> => {
  const ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      resolve();
    };

    ws.onerror = (error) => {
      reject(error);
    };
  });

  return ws;
};

const canvasToJpegBytes = async (
  canvas: HTMLCanvasElement,
  jpegQuality: number,
): Promise<Uint8Array> => {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("toBlob() returned null"));
          return;
        }

        resolve(result);
      },
      "image/jpeg",
      jpegQuality,
    );
  });

  return new Uint8Array(await blob.arrayBuffer());
};

let sent = 0;
let last = performance.now();

const markSent = () => {
  sent += 1;

  const now = performance.now();
  if (now - last < 1000) {
    return;
  }

  console.log("sender fps", sent);
  sent = 0;
  last = now;
};

export const useJpegSocketStream = (options: UseJpegSocketStreamOptions): void => {
  const {
    wsUrl,
    fps = 15,
    jpegQuality = 0.7,
    maxBufferedBytes = 2_000_000,
  } = options;

  const { gl } = useThree();

  const wsRef = useRef<WebSocket | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const encodeInProgressRef = useRef<boolean>(false);

  const frameIntervalMs = useMemo(() => {
    const safeFps = Math.max(1, fps);
    return 1000 / safeFps;
  }, [fps]);

  const safeQuality = useMemo(() => clamp01(jpegQuality), [jpegQuality]);

  useEffect(() => {
    let disposed = false;

    const connect = async (): Promise<void> => {
      console.log(`Connecting to WebSocket at ${wsUrl}...`);
      const ws = await createWebSocket(wsUrl);

      if (disposed) {
        ws.close();
        return;
      }

      ws.onclose = () => {
        if (!disposed) {
          wsRef.current = null;
        }
      };

      wsRef.current = ws;
    };

    void connect();

    return () => {
      disposed = true;

      const ws = wsRef.current;
      wsRef.current = null;

      if (ws) {
        ws.close();
      }
    };
  }, [wsUrl]);

  const shouldSkipForBackpressure = (): boolean => {
    const ws = wsRef.current;

    if (!ws) {
      return true;
    }

    return ws.bufferedAmount > maxBufferedBytes;
  };

  const shouldSendNow = (): boolean => {
    const now = performance.now();
    const last = lastSentAtRef.current;

    if (now - last < frameIntervalMs) {
      return false;
    }

    lastSentAtRef.current = now;
    return true;
  };

  
  const sendFrame = async (): Promise<void> => {
    const ws = wsRef.current;

    if (!ws) {
      return;
    }

    const canvas = gl.domElement;
const source = gl.domElement;

    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

  if (isCanvasBlank(canvas)) return;  // <-- bail early
    const jpegBytes = await canvasToJpegBytes(canvas, safeQuality);

    const header = encodeU32BE(jpegBytes.byteLength);
    const packet = new Uint8Array(4 + jpegBytes.byteLength);

    packet.set(header, 0);
    packet.set(jpegBytes, 4);

    ws.send(packet.buffer);
    markSent();
  };

  const maybeSendFrame = async (): Promise<void> => {
    if (!shouldSendNow()) {
      return;
    }

    if (shouldSkipForBackpressure()) {
      return;
    }

    if (encodeInProgressRef.current) {
      return;
    }

    encodeInProgressRef.current = true;

    try {
      await sendFrame();
    } finally {
      encodeInProgressRef.current = false;
    }
  };

  const makeFramesPerSecondLogger = (label: string) => {
  let frameCount = 0;
  let lastReportTime = performance.now();

  return () => {
    frameCount += 1;

    const now = performance.now();
    if (now - lastReportTime < 1000) {
      return;
    }

    console.log(label, frameCount);
    frameCount = 0;
    lastReportTime = now;
  };
};


const logUseFrameRate = useMemo(() => makeFramesPerSecondLogger("useFrame calls per second"), []);
  useFrame((_state: RootState) => {
    void maybeSendFrame();
    logUseFrameRate();
  }, 2);
};