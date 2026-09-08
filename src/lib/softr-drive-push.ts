import { isSoftrEtNumber } from "./softr-et-numbers.ts";
import { isSoftrTfNumber } from "./softr-tf-numbers.ts";
import asManifest from "./softr-as-manifest.json" with { type: "json" };
import ksManifest from "./softr-ks-manifest.json" with { type: "json" };

export type SoftrDriveJob = { folderId: string; name: string; rel: string; kind: "AS" | "ER" | "TF" | "KS" };

const SOFTR_FOLDERS: Record<string, string> = {
  "AS:job-hillerodsholm": "15WmwaBcxQXdCcYGTHyYs96gcyqrlHnR5",
  "AS:job-islevvaenge": "1lCtNYoq9ZhLU3IHyVNEBypFeuDRoqS44",
  "AS:job-kaerhuset": "1ZQ44KnOiZ1x7YSKXHypun20LOJG4ubPJ",
  "AS:job-provestenen": "1Vs_2Hsy6G-wWdVWlI-vr2XY3-mKcSRkm",
  "ER:job-hillerodsholm": "1g20TbklXMeqWJfNU7aDknf8nbH32jVGu",
  "ER:job-islevvaenge": "1PtGpvVnAZ6SdY2GaXIwoYpJsf1_IBZUX",
  "ER:job-kaerhuset": "187g2EsAyZuTcjxcHwaOpIQZEnF-h4Red",
  "TF:job-hillerodsholm": "19By1JGmOPwfdyJ3qjkrfhQIoe6ieVFi4",
  "TF:job-islevvaenge": "1WKMvztEncjipfTnfSZM4IHtFxza1F0-t",
  "TF:job-kaerhuset": "1VEKUKoyV29q9YuKl9TWpUMbCO5IGLr9x",
  "KS:job-hillerodsholm": "1vAzLkX6tu1kZFlH50Ts77R4aLIHs0mH7",
  "KS:job-kaerhuset": "1EIqmYE24Z2kKEXCQErn5D-auhMynnzE-",
  "KS:job-islevvaenge": "1S-kEhimtO4gfST4-b61FKXB4yj9eCpRR",
  "KS:job-provestenen": "1eAsy_LmOm9Lf8RR3HK-OamOdqSQB-coG",
};

type AsRow = { no: number; projectId: string; photos: { file: string; name: string }[] };
type KsRow = { no: number; projectId?: string; photos: { file: string; name: string }[] };

function safe(s: string) {
  return s.replace(/[^\w.\-æøåÆØÅ]+/g, "_").slice(0, 80);
}

let cached: SoftrDriveJob[] | null = null;

export function softrDriveJobs(): SoftrDriveJob[] {
  if (cached) return cached;
  const out: SoftrDriveJob[] = [];
  const used = new Set<string>();
  for (const r of asManifest as AsRow[]) {
    const kind: "AS" | "ER" | "TF" = isSoftrEtNumber(r.no) ? "ER" : isSoftrTfNumber(r.no) ? "TF" : "AS";
    const folderId = SOFTR_FOLDERS[`${kind}:${r.projectId}`];
    if (!folderId) continue;
    (r.photos || []).forEach((p, i) => {
      let name = `${kind}-${r.no}-${safe(p.name || `foto-${i + 1}.jpg`)}`;
      let n = 2;
      while (used.has(`${folderId}:${name.toLowerCase()}`)) {
        name = `${kind}-${r.no}-${n}-${safe(p.name || `foto.jpg`)}`;
        n += 1;
      }
      used.add(`${folderId}:${name.toLowerCase()}`);
      out.push({ folderId, name, rel: p.file.replace(/^\//, ""), kind });
    });
  }
  for (const r of ksManifest as KsRow[]) {
    const pid = r.projectId || "job-hillerodsholm";
    const folderId = SOFTR_FOLDERS[`KS:${pid}`];
    if (!folderId) continue;
    (r.photos || []).forEach((p, i) => {
      let name = `KS-${r.no}-${safe(p.name || `foto-${i + 1}.jpg`)}`;
      let n = 2;
      while (used.has(`${folderId}:${name.toLowerCase()}`)) {
        name = `KS-${r.no}-${n}-${safe(p.name || "foto.jpg")}`;
        n += 1;
      }
      used.add(`${folderId}:${name.toLowerCase()}`);
      out.push({ folderId, name, rel: p.file.replace(/^\//, ""), kind: "KS" });
    });
  }
  cached = out;
  return out;
}

export function softrKsDriveJobs() {
  return softrDriveJobs().filter((j) => j.kind === "KS");
}

