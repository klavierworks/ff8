// Streamer.tsx
import { FC } from "react";
import { useJpegSocketStream } from "./useJpegSocketStream.js";

export const Streamer: FC = () => {
  useJpegSocketStream({
    wsUrl: "ws://localhost:8080/ingest",
    fps: 24,
    jpegQuality: 1,
    maxBufferedBytes: 2_000_000,
    targetWidth: 400,
    targetHeight: 300,
  });

  return null;
};