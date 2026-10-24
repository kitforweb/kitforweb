/** Rasterises an SVG string to a PNG Blob at `scale` × its viewBox size. */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const el = doc.documentElement;
  const box = el
    .getAttribute("viewBox")
    ?.split(/[\s,]+/)
    .map(Number);
  const width = box?.[2] ?? (Number(el.getAttribute("width")) || 800);
  const height = box?.[3] ?? (Number(el.getAttribute("height")) || 600);
  el.setAttribute("width", String(width));
  el.setAttribute("height", String(height));
  const data = new XMLSerializer().serializeToString(el);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"),
  );
}
