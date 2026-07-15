import { promises as fs } from "fs";
import path from "path";

import { getEnv } from "@/lib/config";

/**
 * Blob storage abstraction, env-switched:
 *  - BLOB_READ_WRITE_TOKEN set   -> Vercel Blob
 *  - BLOB_READ_WRITE_TOKEN unset -> local filesystem at ./.data/blobs
 *
 * Keys are opaque strings like "acfr/<uuid>.pdf".
 */

const LOCAL_ROOT = path.join(process.cwd(), ".data", "blobs");

function isVercelBlobEnabled(): boolean {
  return getEnv().BLOB_READ_WRITE_TOKEN.length > 0;
}

/** True when Vercel Blob is configured (direct-to-blob uploads available). */
export function isBlobEnabled(): boolean {
  return isVercelBlobEnabled();
}


export async function putBlob(key: string, data: Buffer): Promise<void> {
  if (isVercelBlobEnabled()) {
    const { put } = await import("@vercel/blob");
    await put(key, data, { access: "public", addRandomSuffix: false });
    return;
  }
  const filePath = path.join(LOCAL_ROOT, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
}

/**
 * Resolve a blob KEY (pathname) to its metadata, or null when absent.
 * `head()` wants a full blob URL and rejects bare pathnames with a generic
 * BlobError, so on any non-not-found failure we fall back to `list()` by
 * prefix, which accepts pathnames by design.
 */
async function headByKey(key: string): Promise<{ url: string; size: number } | null> {
  const { head, list, BlobNotFoundError } = await import("@vercel/blob");
  try {
    const meta = await head(key);
    return { url: meta.url, size: meta.size };
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    const { blobs } = await list({ prefix: key, limit: 10 });
    const hit = blobs.find((b) => b.pathname === key);
    return hit ? { url: hit.url, size: hit.size } : null;
  }
}

export async function getBlob(key: string): Promise<Buffer> {
  if (isVercelBlobEnabled()) {
    const meta = await headByKey(key);
    if (!meta) throw new Error(`Blob not found: ${key}`);
    const res = await fetch(meta.url);
    if (!res.ok) throw new Error(`Blob fetch failed for ${key}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  try {
    return await fs.readFile(path.join(LOCAL_ROOT, key));
  } catch {
    // Pre-loaded demo documents live in ./samples and are addressed by
    // "samples/<file>" keys without being copied into .data/blobs first.
    if (key.startsWith("samples/")) {
      return fs.readFile(path.join(process.cwd(), key));
    }
    throw new Error(`Blob not found: ${key}`);
  }
}

/**
 * Return blob metadata (byte size) for a key, or null when it does not exist.
 * With Vercel Blob this is a `head()` call; locally it stats the file under
 * ./.data/blobs (falling back to ./samples for pre-loaded demo keys).
 */
export async function statBlob(key: string): Promise<{ size: number } | null> {
  if (isVercelBlobEnabled()) {
    const meta = await headByKey(key);
    return meta ? { size: meta.size } : null;
  }
  try {
    const st = await fs.stat(path.join(LOCAL_ROOT, key));
    return { size: st.size };
  } catch {
    if (key.startsWith("samples/")) {
      try {
        const st = await fs.stat(path.join(process.cwd(), key));
        return { size: st.size };
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** True when a blob exists for the given key. */
export async function blobExists(key: string): Promise<boolean> {
  return (await statBlob(key)) !== null;
}

/**
 * Copy a local file (e.g. a pre-loaded sample ACFR from ./samples) into blob
 * storage under the given key. Used by the demo registration flow and seed.
 */
export async function putBlobFromFile(key: string, localPath: string): Promise<number> {
  const data = await fs.readFile(localPath);
  await putBlob(key, data);
  return data.byteLength;
}
