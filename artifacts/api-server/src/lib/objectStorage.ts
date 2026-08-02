import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';

/**
 * Local-disk object storage.
 *
 * Uploaded files live under UPLOAD_DIR (default `/data/uploads`), which should be
 * a persistent volume when deployed. The public API deliberately mirrors the
 * presigned-URL flow the frontend already implements:
 *
 *   1. POST /api/storage/uploads/request-url  -> { uploadURL, objectPath }
 *   2. PUT  <uploadURL>  (raw file body)      -> file written to disk
 *   3. GET  /api/storage/objects/<id>         -> file served back
 *
 * `uploadURL` is a same-origin, HMAC-signed, short-lived URL. No cloud provider
 * and no credentials are required.
 */

export const UPLOAD_DIR = path.resolve(
  process.env['UPLOAD_DIR'] || '/data/uploads',
);

/** Subdirectory (inside UPLOAD_DIR) that admin uploads are written to. */
const ENTITY_PREFIX = 'uploads';

/** Subdirectory (inside UPLOAD_DIR) served by the public-objects route. */
const PUBLIC_PREFIX = 'public';

const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class InvalidUploadTokenError extends Error {
  constructor(message = 'Invalid or expired upload token') {
    super(message);
    this.name = 'InvalidUploadTokenError';
    Object.setPrototypeOf(this, InvalidUploadTokenError.prototype);
  }
}

/** A resolved on-disk object. */
export interface StoredObject {
  /** Absolute path on disk. */
  absolutePath: string;
  /** Path relative to UPLOAD_DIR, e.g. "uploads/<uuid>.jpg". */
  key: string;
  size: number;
  contentType: string;
}

function uploadSigningSecret(): string {
  const secret = process.env['SESSION_SECRET'];
  if (!secret) {
    throw new Error(
      'SESSION_SECRET environment variable is required to sign upload URLs',
    );
  }
  return secret;
}

/**
 * Reject anything that could escape UPLOAD_DIR. Keys are always
 * "<prefix>/<segments>" with no "..", no absolute paths and no backslashes.
 */
function assertSafeKey(key: string): void {
  if (
    !key ||
    key.includes('\\') ||
    key.startsWith('/') ||
    key
      .split('/')
      .some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new ObjectNotFoundError();
  }
}

function resolveKey(key: string): string {
  assertSafeKey(key);
  const absolutePath = path.resolve(UPLOAD_DIR, key);
  const root = UPLOAD_DIR.endsWith(path.sep)
    ? UPLOAD_DIR
    : `${UPLOAD_DIR}${path.sep}`;
  if (!absolutePath.startsWith(root)) {
    throw new ObjectNotFoundError();
  }
  return absolutePath;
}

function guessContentType(filePath: string): string {
  return (
    MIME_BY_EXT[path.extname(filePath).toLowerCase()] ||
    'application/octet-stream'
  );
}

/** Keep only a safe extension from a user-supplied filename. */
function safeExtension(name: string | undefined): string {
  if (!name) return '';
  const ext = path.extname(name).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

function sign(key: string, expiresAt: number): string {
  return createHmac('sha256', uploadSigningSecret())
    .update(`${key}:${expiresAt}`)
    .digest('hex');
}

function verifySignature(
  key: string,
  expiresAt: number,
  token: string,
): boolean {
  const expected = Buffer.from(sign(key, expiresAt), 'utf8');
  const provided = Buffer.from(token, 'utf8');
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export class ObjectStorageService {
  /** Ensure the storage directories exist. Safe to call repeatedly. */
  async init(): Promise<void> {
    await mkdir(path.join(UPLOAD_DIR, ENTITY_PREFIX), { recursive: true });
    await mkdir(path.join(UPLOAD_DIR, PUBLIC_PREFIX), { recursive: true });
  }

  /**
   * Mint a short-lived, signed, same-origin upload URL.
   * Returns both the URL to PUT to and the canonical `/objects/...` path that
   * should be persisted in the database.
   */
  createUploadTicket(fileName?: string): {
    uploadURL: string;
    objectPath: string;
  } {
    const objectId = `${randomUUID()}${safeExtension(fileName)}`;
    const key = `${ENTITY_PREFIX}/${objectId}`;
    const expiresAt = Date.now() + UPLOAD_TOKEN_TTL_MS;
    const token = sign(key, expiresAt);

    return {
      uploadURL: `/api/storage/uploads/${encodeURIComponent(objectId)}?expires=${expiresAt}&token=${token}`,
      objectPath: `/objects/${ENTITY_PREFIX}/${objectId}`,
    };
  }

  /** Validate a signed upload URL and stream the request body to disk. */
  async saveUpload({
    objectId,
    expires,
    token,
    body,
    contentType,
  }: {
    objectId: string;
    expires: string | undefined;
    token: string | undefined;
    body: Readable;
    contentType?: string | undefined;
  }): Promise<{ objectPath: string }> {
    const key = `${ENTITY_PREFIX}/${objectId}`;
    assertSafeKey(key);

    const expiresAt = Number(expires);
    if (!token || !Number.isFinite(expiresAt)) {
      throw new InvalidUploadTokenError();
    }
    if (Date.now() > expiresAt) {
      throw new InvalidUploadTokenError('Upload URL has expired');
    }
    if (!verifySignature(key, expiresAt, token)) {
      throw new InvalidUploadTokenError();
    }

    const absolutePath = resolveKey(key);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await pipeline(body, createWriteStream(absolutePath));

    // Persist the declared content type alongside the file so it can be
    // served back accurately even for extension-less uploads.
    if (contentType) {
      await writeFile(
        `${absolutePath}.meta.json`,
        JSON.stringify({ contentType }),
        'utf8',
      );
    }

    return { objectPath: `/objects/${key}` };
  }

  /** Resolve `/objects/<key>` to a file on disk. */
  async getObjectEntityFile(objectPath: string): Promise<StoredObject> {
    if (!objectPath.startsWith('/objects/')) {
      throw new ObjectNotFoundError();
    }
    return this.getByKey(objectPath.slice('/objects/'.length));
  }

  /** Resolve a file inside the public directory. */
  async searchPublicObject(filePath: string): Promise<StoredObject | null> {
    try {
      return await this.getByKey(`${PUBLIC_PREFIX}/${filePath}`);
    } catch {
      return null;
    }
  }

  async getByKey(key: string): Promise<StoredObject> {
    const absolutePath = resolveKey(key);

    let stats;
    try {
      stats = await stat(absolutePath);
    } catch {
      throw new ObjectNotFoundError();
    }
    if (!stats.isFile()) {
      throw new ObjectNotFoundError();
    }

    let contentType = guessContentType(absolutePath);
    try {
      const meta = JSON.parse(
        await readFile(`${absolutePath}.meta.json`, 'utf8'),
      ) as { contentType?: string };
      if (meta.contentType) contentType = meta.contentType;
    } catch {
      // No sidecar metadata — fall back to the extension-based guess.
    }

    return { absolutePath, key, size: stats.size, contentType };
  }

  /** Open a read stream for a resolved object. */
  createReadStream(object: StoredObject): Readable {
    return createReadStream(object.absolutePath);
  }

  async delete(objectPath: string): Promise<void> {
    const object = await this.getObjectEntityFile(objectPath);
    await unlink(object.absolutePath).catch(() => undefined);
    await unlink(`${object.absolutePath}.meta.json`).catch(() => undefined);
  }
}
