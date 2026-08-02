import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import {
  InvalidUploadTokenError,
  ObjectNotFoundError,
  ObjectStorageService,
  type StoredObject,
} from '../lib/objectStorage';

const router: IRouter = Router();
export const objectStorageService = new ObjectStorageService();

const MAX_UPLOAD_BYTES = Number(
  process.env['MAX_UPLOAD_BYTES'] || 25 * 1024 * 1024,
);

function sendObject(
  req: Request,
  res: Response,
  object: StoredObject,
  cacheTtlSec = 3600,
): void {
  res.setHeader('Content-Type', object.contentType);
  res.setHeader('Content-Length', String(object.size));
  res.setHeader('Cache-Control', `public, max-age=${cacheTtlSec}`);

  const stream = objectStorageService.createReadStream(object);
  stream.on('error', (err) => {
    req.log.error({ err }, 'Error streaming object from disk');
    if (!res.headersSent) res.status(500).end();
    else res.destroy();
  });
  stream.pipe(res);
}

/**
 * POST /storage/uploads/request-url
 *
 * Mint a short-lived signed URL the admin UI can PUT the file to.
 * Protected by admin session — only authenticated admins can request one.
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

    const { name, size, contentType } = parsed.data;

    if (size > MAX_UPLOAD_BYTES) {
      res.status(413).json({
        error: `File is too large. Maximum size is ${Math.floor(
          MAX_UPLOAD_BYTES / 1024 / 1024,
        )} MB.`,
      });
      return;
    }

    try {
      const { uploadURL, objectPath } =
        objectStorageService.createUploadTicket(name);

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
 * PUT /storage/uploads/:objectId
 *
 * Receives the raw file body. Authorised by the signed token in the query
 * string rather than by session, matching the presigned-URL flow.
 */
router.put('/storage/uploads/:objectId', async (req: Request, res: Response) => {
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (declaredLength > MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: 'File is too large' });
    return;
  }

  try {
    const objectId = decodeURIComponent(String(req.params['objectId']));
    const { expires, token } = req.query as {
      expires?: string;
      token?: string;
    };

    const result = await objectStorageService.saveUpload({
      objectId,
      expires,
      token,
      body: req,
      contentType: req.headers['content-type'],
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof InvalidUploadTokenError) {
      res.status(403).json({ error: error.message });
      return;
    }
    if (error instanceof ObjectNotFoundError) {
      res.status(400).json({ error: 'Invalid upload target' });
      return;
    }
    req.log.error({ err: error }, 'Error saving upload');
    res.status(500).json({ error: 'Failed to save upload' });
  }
});

/**
 * GET /storage/public-objects/*
 * Unconditionally public — no auth required.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params['filePath'];
      const filePath = Array.isArray(raw) ? raw.join('/') : String(raw);
      const object = await objectStorageService.searchPublicObject(filePath);
      if (!object) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      sendObject(req, res, object);
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
    const raw = req.params['path'];
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : String(raw);
    const object = await objectStorageService.getObjectEntityFile(
      `/objects/${wildcardPath}`,
    );
    sendObject(req, res, object);
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
