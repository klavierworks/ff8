import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { extname, join, resolve, sep } from 'path';

const CONVERTED_DIR = resolve(process.cwd(), 'extractor/data/converted');

const CONTENT_TYPES = {
  '.glb': 'model/gltf-binary',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.obj': 'text/plain',
  '.png': 'image/png',
  '.wav': 'audio/wav',
};

const resolveRequestedFile = (url) => {
  const path = decodeURIComponent(url.split('?')[0]);
  const file = resolve(join(CONVERTED_DIR, path));
  return file.startsWith(`${CONVERTED_DIR}${sep}`) ? file : undefined;
};

const parseRange = (header, size) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!match) {
    return undefined;
  }
  const start = match[1] === '' ? size - Number(match[2]) : Number(match[1]);
  const end = match[1] === '' || match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  return start <= end ? { end, start } : undefined;
};

const sendFile = (req, res, file, size) => {
  res.setHeader('Content-Type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-cache');

  const range = parseRange(req.headers.range, size);
  if (!range) {
    res.setHeader('Content-Length', size);
    createReadStream(file).pipe(res);
    return;
  }

  res.statusCode = 206;
  res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  res.setHeader('Content-Length', range.end - range.start + 1);
  createReadStream(file, range).pipe(res);
};

// Serves the extractor output during `vite` and `vite preview`, standing in for the host that
// serves it in production. Nothing here reaches the build output.
export function extractorDataPlugin(urlPrefix) {
  const handleRequest = async (req, res, next) => {
    const file = resolveRequestedFile(req.url ?? '');
    if (!file) {
      next();
      return;
    }
    try {
      const stats = await stat(file);
      if (!stats.isFile()) {
        next();
        return;
      }
      sendFile(req, res, file, stats.size);
    } catch {
      res.statusCode = 404;
      res.end();
    }
  };

  return {
    name: 'extractor-data',

    configureServer(server) {
      server.middlewares.use(urlPrefix, handleRequest);
    },

    configurePreviewServer(server) {
      server.middlewares.use(urlPrefix, handleRequest);
    },
  };
}
