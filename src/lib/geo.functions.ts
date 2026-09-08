import { createServerFn } from "@tanstack/react-start";
import { formatDaAddress } from "./geo";

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
};

async function fromNominatim(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&addressdetails=1&zoom=18&accept-language=da`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "da",
      "User-Agent": "ZenkoPlads/1.0 (zenko.danmark@gmail.com)",
    },
  });
  if (!res.ok) return "";
  const json = (await res.json()) as { address?: NominatimAddress; display_name?: string };
  return formatDaAddress({ ...(json.address ?? {}), display_name: json.display_name });
}

export const reverseGeocode = createServerFn({ method: "POST" })
  .validator((input: { lat: number; lng: number }) => input)
  .handler(async ({ data }) => {
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false as const, address: "" };
    try {
      const address = await fromNominatim(lat, lng);
      return { ok: Boolean(address), address };
    } catch {
      return { ok: false as const, address: "" };
    }
  });
