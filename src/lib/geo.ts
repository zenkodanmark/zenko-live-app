import type { GpsFix, GpsSource, Project } from "./types";

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatCoords(lat: number, lng: number) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}° ${ns}, ${Math.abs(lng).toFixed(5)}° ${ew}`;
}

export function formatFix(fix: GpsFix) {
  return `${formatCoords(fix.lat, fix.lng)} · ±${Math.round(fix.accuracyM)} m`;
}

export function siteFallback(project: Project, at = new Date().toISOString()): GpsFix {
  return {
    lat: project.lat,
    lng: project.lng,
    accuracyM: project.radiusM,
    altitudeM: null,
    heading: null,
    speedMps: null,
    at,
    source: "site-fallback",
  };
}

export function insideZone(fix: { lat: number; lng: number }, project: Project) {
  return haversineM(fix, project) <= project.radiusM;
}

export function gpsSourceLabel(source: GpsSource | "unknown") {
  if (source === "exif") return "foto-EXIF";
  if (source === "site-fallback") return "sagens position";
  if (source === "device") return "telefon";
  return "ukendt";
}

export function rankedSites(fix: { lat: number; lng: number }, projects: Project[]) {
  return [...projects].sort((a, b) => haversineM(fix, a) - haversineM(fix, b));
}

export function sagFromFix(fix: { lat: number; lng: number }, allowed: Project[], fallback?: Project) {
  if (!allowed.length) return fallback;
  const ranked = rankedSites(fix, allowed);
  return ranked.find((p) => insideZone(fix, p)) ?? ranked[0] ?? fallback;
}

export type GpsAsk = { ok: true; fix: GpsFix } | { ok: false; reason: "denied" | "timeout" | "unavailable" };

export function askGps(timeoutMs = 20000): Promise<GpsAsk> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: "unavailable" });
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: GpsAsk) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    const timer = window.setTimeout(() => finish({ ok: false, reason: "timeout" }), timeoutMs + 400);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        finish({
          ok: true,
          fix: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
            altitudeM: pos.coords.altitude,
            heading: pos.coords.heading,
            speedMps: pos.coords.speed,
            at: new Date().toISOString(),
            source: "device",
          },
        });
      },
      (err) => {
        window.clearTimeout(timer);
        if (err?.code === 1) finish({ ok: false, reason: "denied" });
        else if (err?.code === 3) finish({ ok: false, reason: "timeout" });
        else finish({ ok: false, reason: "unavailable" });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

export function formatDaAddress(input: {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  display_name?: string;
}): string {
  const street = [input.road || input.pedestrian, input.house_number].filter(Boolean).join(" ");
  const place = input.city || input.town || input.village || input.municipality || input.suburb || "";
  const cityLine = [input.postcode, place].filter(Boolean).join(" ");
  return [street, cityLine].filter(Boolean).join(", ") || input.display_name?.trim() || "";
}

export function readGps(timeoutMs = 8000): Promise<GpsFix | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          altitudeM: pos.coords.altitude,
          heading: pos.coords.heading,
          speedMps: pos.coords.speed,
          at: new Date().toISOString(),
          source: "device",
        });
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15000 },
    );
  });
}
