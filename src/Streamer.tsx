// Streamer.tsx
import { FC } from "react";
import { useJpegSocketStream } from "./useJpegSocketStream.js";

export const Streamer: FC = () => {
  useJpegSocketStream({
    wsUrl: "ws://localhost:8080/ingest",
    fps: 60,
    jpegQuality: 0.7,
    maxBufferedBytes: 2_000_000,
  });

  return null;
};