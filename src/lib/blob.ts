/**
 * Resolve the Vercel Blob read-write token.
 *
 * When a project has more than one Blob store connected, Vercel prefixes the injected
 * env vars (e.g. BLOB_MEDIA_READ_WRITE_TOKEN). We check the standard name first and then
 * the known prefixed name, so the panel keeps working regardless of the store naming.
 *
 * NOTE: only ONE Blob store should stay connected to the project. If a private store is
 * also connected it provides the standard BLOB_READ_WRITE_TOKEN and would win here — keep
 * only the public store connected.
 */
export function blobToken(): string | undefined {
    return process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_MEDIA_READ_WRITE_TOKEN || undefined;
}
