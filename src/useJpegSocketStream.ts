// useJpegSocketStream.ts
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";

type UseJpegSocketStreamOptions = {
  wsUrl: string;
  fps?: number;
  jpegQuality?: number;
  maxBufferedBytes?: number;
  targetWidth?: number;
  targetHeight?: number;
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
    targetWidth = 320,
    targetHeight = 240,
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
    if (!ws) return;

    const canvas = gl.domElement;
    if (!(canvas instanceof HTMLCanvasElement)) return;

    // Draw to offscreen synchronously before any await
    const offscreen = document.createElement("canvas");
    offscreen.width = targetWidth;
    offscreen.height = targetHeight;
    const ctx = offscreen.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    // Now encode asynchronously from the offscreen canvas
    const jpegBytes = await canvasToJpegBytes(offscreen, safeQuality);
    ws.send(jpegBytes.buffer);
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