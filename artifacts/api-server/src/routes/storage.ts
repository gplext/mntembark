import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const uploadDir = process.env['UPLOAD_DIR'] || path.resolve(process.cwd(), 'data/uploads');
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch {
    // Directory might already exist or will be created on container boot
  }
}

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
};

/**
 * POST /storage/uploads/request-url
 *
 * Request an upload URL for file upload.
 * Protected by admin session — only authenticated admins can mint upload URLs.
 */
router.post(
  '/storage/uploads/request-url',
  requireAdmin,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;
      let uploadURL: string;
      let objectPath: string;

      if (process.env.PRIVATE_OBJECT_DIR) {
        try {
          uploadURL = await objectStorageService.getObjectEntityUploadURL();
          objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
        } catch {
          const fileId = `${randomUUID()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          uploadURL = `/api/storage/local-upload/${fileId}`;
          objectPath = `/objects/uploads/${fileId}`;
        }
      } else {
        const fileId = `${randomUUID()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        uploadURL = `/api/storage/local-upload/${fileId}`;
        objectPath = `/objects/uploads/${fileId}`;
      }

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

/**
 * PUT /storage/local-upload/:fileId
 * Handles raw stream uploads for local disk storage.
 */
router.put(
  '/storage/local-upload/:fileId',
  requireAdmin,
  (req: Request, res: Response) => {
    const raw = req.params.fileId;
    const fileId = Array.isArray(raw) ? raw[0] : raw;
    const safeFilename = path.basename(fileId);
    const targetPath = path.join(uploadDir, safeFilename);

    const writeStream = fs.createWriteStream(targetPath);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      res.status(200).json({ ok: true });
    });

    writeStream.on('error', (err) => {
      req.log.error({ err }, 'Error writing uploaded file to disk');
      res.status(500).json({ error: 'Failed to save file' });
    });
  },
);

/**
 * GET /storage/public-objects/*
 * Unconditionally public — no auth required.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      const response = await objectStorageService.downloadObject(file);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 * Serves uploaded object entities — public read (images used in the site).
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;

    // Check local disk storage first (e.g. /data/uploads)
    const localFilename = path.basename(wildcardPath);
    const localFilePath = path.join(uploadDir, localFilename);

    if (fs.existsSync(localFilePath)) {
      const ext = path.extname(localFilePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const stat = fs.statSync(localFilePath);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(localFilePath).pipe(res);
      return;
    }

    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

export default router;
