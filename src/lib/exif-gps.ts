import type { GpsFix } from "./types";

export async function gpsFromImage(file: File): Promise<GpsFix | null> {
  try {
    const buf = new Uint8Array(await file.slice(0, Math.min(file.size, 256_000)).arrayBuffer());
    const parsed = parseJpegGps(buf);
    if (!parsed) return null;
    return {
      lat: parsed.lat,
      lng: parsed.lng,
      accuracyM: parsed.accuracy ?? 18,
      altitudeM: parsed.alt,
      heading: null,
      speedMps: null,
      at: new Date().toISOString(),
      source: "exif",
    };
  } catch {
    return null;
  }
}

function parseJpegGps(buf: Uint8Array): { lat: number; lng: number; alt: number | null; accuracy?: number } | null {
  if (buf.length < 12 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1]!;
    if (marker === 0xda) break;
    const len = (buf[i + 2]! << 8) | buf[i + 3]!;
    if (len < 2 || i + 2 + len > buf.length) break;
    if (marker === 0xe1) {
      const gps = readExifGps(buf.subarray(i + 4, i + 2 + len));
      if (gps) return gps;
    }
    i += 2 + len;
  }
  return null;
}

function readExifGps(seg: Uint8Array): { lat: number; lng: number; alt: number | null; accuracy?: number } | null {
  if (seg.length < 16) return null;
  const head = String.fromCharCode(...seg.subarray(0, 4));
  if (head !== "Exif") return null;
  const tiff = seg.subarray(6);
  const le = tiff[0] === 0x49 && tiff[1] === 0x49;
  const be = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!le && !be) return null;
  const v = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const u16 = (o: number) => (le ? v.getUint16(o, true) : v.getUint16(o, false));
  const u32 = (o: number) => (le ? v.getUint32(o, true) : v.getUint32(o, false));
  const ifd0 = u32(4);
  const gpsOff = findTagOffset(v, ifd0, 0x8825, le, u16, u32);
  if (gpsOff == null) return null;
  const tags = readIfd(v, gpsOff, le, u16, u32);
  const latRef = strTag(v, tags[1], le);
  const lngRef = strTag(v, tags[3], le);
  const lat = dms(v, tags[2], le);
  const lng = dms(v, tags[4], le);
  if (lat == null || lng == null) return null;
  const alt = rat(v, tags[6], le);
  const acc = rat(v, tags[0x1f], le);
  return {
    lat: latRef === "S" ? -lat : lat,
    lng: lngRef === "W" ? -lng : lng,
    alt: alt ?? null,
    accuracy: acc ?? undefined,
  };
}

type Tag = { type: number; count: number; value: number };

function findTagOffset(
  v: DataView,
  ifd: number,
  want: number,
  le: boolean,
  u16: (o: number) => number,
  u32: (o: number) => number,
): number | null {
  if (ifd + 2 > v.byteLength) return null;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12;
    if (o + 12 > v.byteLength) break;
    if (u16(o) === want) return u32(o + 8);
  }
  return null;
}

function readIfd(
  v: DataView,
  ifd: number,
  le: boolean,
  u16: (o: number) => number,
  u32: (o: number) => number,
): Record<number, Tag> {
  const out: Record<number, Tag> = {};
  if (ifd + 2 > v.byteLength) return out;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12;
    if (o + 12 > v.byteLength) break;
    out[u16(o)] = { type: u16(o + 2), count: u32(o + 4), value: u32(o + 8) };
  }
  return out;
}

function strTag(v: DataView, tag: Tag | undefined, le: boolean): string {
  if (!tag) return "";
  const o = tag.count <= 4 ? tag.value : tag.value;
  if (tag.count <= 4) {
    const bytes = le
      ? [tag.value & 0xff, (tag.value >> 8) & 0xff, (tag.value >> 16) & 0xff, (tag.value >> 24) & 0xff]
      : [(tag.value >> 24) & 0xff, (tag.value >> 16) & 0xff, (tag.value >> 8) & 0xff, tag.value & 0xff];
    return String.fromCharCode(...bytes.filter((b) => b && b !== 0));
  }
  if (o + 1 > v.byteLength) return "";
  return String.fromCharCode(v.getUint8(o));
}

function dms(v: DataView, tag: Tag | undefined, le: boolean): number | null {
  if (!tag || tag.count < 3) return null;
  const off = tag.value;
  if (off + 24 > v.byteLength) return null;
  const n = (o: number) => {
    const num = le ? v.getUint32(o, true) : v.getUint32(o, false);
    const den = le ? v.getUint32(o + 4, true) : v.getUint32(o + 4, false);
    return den ? num / den : 0;
  };
  return n(off) + n(off + 8) / 60 + n(off + 16) / 3600;
}

function rat(v: DataView, tag: Tag | undefined, le: boolean): number | null {
  if (!tag) return null;
  if (tag.count === 1 && tag.type === 5) {
    const off = tag.value;
    if (off + 8 > v.byteLength) return null;
    const num = le ? v.getUint32(off, true) : v.getUint32(off, false);
    const den = le ? v.getUint32(off + 4, true) : v.getUint32(off + 4, false);
    return den ? num / den : null;
  }
  return null;
}
