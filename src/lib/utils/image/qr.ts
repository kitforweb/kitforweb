import QRCode from "qrcode";

export type ErrorLevel = "L" | "M" | "Q" | "H";

/** WiFi network for the "WIFI:" payload that phone cameras understand. */
export interface WifiInput {
  ssid: string;
  password: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}

/** Special characters of the WIFI: and MECARD formats are escaped with a backslash. */
const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");

export function wifiPayload(w: WifiInput): string {
  const parts = [`T:${w.encryption}`, `S:${esc(w.ssid)}`];
  if (w.encryption !== "nopass") parts.push(`P:${esc(w.password)}`);
  if (w.hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

export interface ContactInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  org: string;
  url: string;
}

const vEsc = (s: string) => s.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

/** A vCard 3.0, the format every phone imports. Empty fields are left out. */
export function vcardPayload(c: ContactInput): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${vEsc(c.lastName)};${vEsc(c.firstName)};;;`];
  lines.push(`FN:${vEsc([c.firstName, c.lastName].filter(Boolean).join(" "))}`);
  if (c.org) lines.push(`ORG:${vEsc(c.org)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone.replace(/[^\d+]/g, "")}`);
  if (c.email) lines.push(`EMAIL:${c.email}`);
  if (c.url) lines.push(`URL:${c.url}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

export interface QrMatrix {
  size: number;
  version: number;
  /** Row-major, true = dark module. */
  modules: boolean[];
}

export type QrResult = { ok: true; qr: QrMatrix } | { ok: false; error: "empty" | "too-long" };

export function qrMatrix(text: string, level: ErrorLevel): QrResult {
  if (!text) return { ok: false, error: "empty" };
  try {
    const q = QRCode.create(text, { errorCorrectionLevel: level });
    const size = q.modules.size;
    const modules: boolean[] = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) modules.push(!!q.modules.get(r, c));
    return { ok: true, qr: { size, version: q.version, modules } };
  } catch {
    return { ok: false, error: "too-long" };
  }
}

export interface QrStyle {
  fg: string;
  bg: string;
  /** Quiet zone in modules (the standard asks for 4). */
  margin: number;
  /** Fraction (0–0.3) of the side covered by the logo, cleared in the middle. */
  logo?: { href: string; ratio: number };
}

/** The QR as a compact SVG: one path for all dark modules, merged per row. */
export function qrSvg(qr: QrMatrix, style: QrStyle): string {
  const n = qr.size + style.margin * 2;
  const logoSize = style.logo ? Math.round(qr.size * style.logo.ratio) : 0;
  const start = Math.floor((qr.size - logoSize) / 2);
  const inLogo = (r: number, c: number) =>
    logoSize > 0 && r >= start - 1 && r < start + logoSize + 1 && c >= start - 1 && c < start + logoSize + 1;
  let d = "";
  for (let r = 0; r < qr.size; r++) {
    let c = 0;
    while (c < qr.size) {
      if (!qr.modules[r * qr.size + c] || inLogo(r, c)) {
        c++;
        continue;
      }
      let len = 1;
      while (c + len < qr.size && qr.modules[r * qr.size + c + len] && !inLogo(r, c + len)) len++;
      d += `M${c + style.margin} ${r + style.margin}h${len}v1h-${len}z`;
      c += len;
    }
  }
  const logo = style.logo
    ? `<image href="${style.logo.href}" x="${start + style.margin}" y="${start + style.margin}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${style.bg}"/><path fill="${style.fg}" d="${d}"/>${logo}</svg>`;
}
