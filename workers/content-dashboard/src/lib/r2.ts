export async function uploadToR2(
  bucket: R2Bucket,
  key: string,
  data: ArrayBuffer,
  contentType: string
): Promise<void> {
  await bucket.put(key, data, {
    httpMetadata: { contentType },
  });
}

export function buildCfUrl(baseUrl: string, key: string): string {
  return `${baseUrl}/${key}?width=1200&format=webp&quality=85`;
}

export function buildCfUrlFull(baseUrl: string, key: string): string {
  return `${baseUrl}/${key}`;
}
