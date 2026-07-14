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

export async function getBlob(key: string): Promise<Buffer> {
  if (isVercelBlobEnabled()) {
    const { head } = await import("@vercel/blob");
    const meta = await head(key);
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
 * Copy a local file (e.g. a pre-loaded sample ACFR from ./samples) into blob
 * storage under the given key. Used by the demo registration flow and seed.
 */
export async function putBlobFromFile(key: string, localPath: string): Promise<number> {
  const data = await fs.readFile(localPath);
  await putBlob(key, data);
  return data.byteLength;
}
