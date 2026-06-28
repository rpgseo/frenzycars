import sharp from 'sharp';

const API_BASE = 'https://api.vehicleimagery.com/api';
const CDN_BASE = 'https://images.vehicleimagery.com';

export interface CarImageRequest {
  make: string;
  model: string;
  year: number;
  variant?: string;
  trim?: string;
  view?: 'front_left' | 'front';
}

export interface CarImageResult {
  buffer: Buffer;
  altText: string;
  filename: string;
  sourceUrl: string;
  view: string;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function buildAltText(make: string, model: string, year: number, view: string): string {
  const viewEs: Record<string, string> = {
    front_left: 'vista frontal tres cuartos',
    front: 'vista frontal',
  };
  return `${make} ${model} ${year} — ${viewEs[view] ?? view}`;
}

async function apiGet(path: string, apiKey: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`Vehicle Imagery API ${path} → ${res.status}`);
  return res.json();
}

async function resolveVariantAndTrim(
  make: string,
  model: string,
  year: number,
  apiKey: string
): Promise<{ variant: string; trim: string } | null> {
  const variants: any[] = await apiGet(`/${make}/${model}/${year}`, apiKey);
  if (!variants?.length) return null;
  const variant = variants[0].variants?.[0];
  if (!variant) return null;
  const trims: any[] = await apiGet(`/${make}/${model}/${year}/${variant}`, apiKey);
  const trim = trims[0]?.trims?.[0];
  if (!trim) return null;
  return { variant, trim };
}

async function resolveAvailableViews(
  make: string,
  model: string,
  year: number,
  variant: string,
  trim: string,
  apiKey: string
): Promise<string[]> {
  const data: any[] = await apiGet(`/${make}/${model}/${year}/${variant}/${trim}`, apiKey);
  const views = data[0]?.views ?? {};
  return Object.entries(views)
    .filter(([, allowed]) => allowed === true)
    .map(([v]) => v);
}

async function downloadAndOptimize(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());
  return sharp(raw)
    .resize(1200, 675, { fit: 'cover', position: 'center' })
    .webp({ quality: 82 })
    .toBuffer();
}

export async function fetchCarImage(
  req: CarImageRequest,
  apiKey: string
): Promise<CarImageResult> {
  const { make, model, year, view: preferredView = 'front_left' } = req;

  let variant = req.variant;
  let trim = req.trim;

  if (!variant || !trim) {
    const resolved = await resolveVariantAndTrim(make, model, year, apiKey);
    if (!resolved) throw new Error(`No variants found for ${make} ${model} ${year}`);
    variant = resolved.variant;
    trim = resolved.trim;
  }

  const availableViews = await resolveAvailableViews(make, model, year, variant!, trim!, apiKey);
  if (!availableViews.length) throw new Error(`No allowed views for ${make} ${model} ${year}`);

  const view = availableViews.includes(preferredView) ? preferredView : availableViews[0];

  const imgData: any[] = await apiGet(`/${make}/${model}/${year}/${variant}/${trim}/${view}`, apiKey);
  const imageUrl: string = imgData[0]?.image_url;
  if (!imageUrl) throw new Error(`No image_url returned for ${make} ${model} ${year} ${view}`);

  const buffer = await downloadAndOptimize(imageUrl);
  const makeSl = slugify(make);
  const modelSl = slugify(model);

  return {
    buffer,
    altText: buildAltText(make, model, year, view),
    filename: `${makeSl}-${modelSl}-${year}-${view}.webp`,
    sourceUrl: imageUrl,
    view,
  };
}

export async function fetchAllCarImages(
  req: Omit<CarImageRequest, 'view'>,
  apiKey: string
): Promise<CarImageResult[]> {
  const { make, model, year } = req;

  let variant = req.variant;
  let trim = req.trim;

  if (!variant || !trim) {
    const resolved = await resolveVariantAndTrim(make, model, year, apiKey);
    if (!resolved) throw new Error(`No variants found for ${make} ${model} ${year}`);
    variant = resolved.variant;
    trim = resolved.trim;
  }

  const availableViews = await resolveAvailableViews(make, model, year, variant!, trim!, apiKey);
  if (!availableViews.length) throw new Error(`No allowed views for ${make} ${model} ${year}`);

  const results: CarImageResult[] = [];
  for (const view of availableViews) {
    const imgData: any[] = await apiGet(`/${make}/${model}/${year}/${variant}/${trim}/${view}`, apiKey);
    const imageUrl: string = imgData[0]?.image_url;
    if (!imageUrl) continue;
    const buffer = await downloadAndOptimize(imageUrl);
    const makeSl = slugify(make);
    const modelSl = slugify(model);
    results.push({
      buffer,
      altText: buildAltText(make, model, year, view),
      filename: `${makeSl}-${modelSl}-${year}-${view}.webp`,
      sourceUrl: imageUrl,
      view,
    });
  }
  return results;
}
