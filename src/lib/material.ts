import { UDBUD_CORPUS } from "./udbud-corpus.ts";
import type { MaterialLine } from "./types.ts";

export type ProductHit = {
  keyword: string;
  found: boolean;
  product: string;
  spec: string;
  cite: string;
  file: string;
};

const KEYWORDS: { key: string; re: RegExp }[] = [
  { key: "mørtel", re: /mørtel|mortel|kalkmørtel|fugemørtel|kc\s*\d|kkh\s*\d/i },
  { key: "bindere", re: /binder|bindere|murbinder/i },
  { key: "isolering", re: /isolering|stenuld|hulmur/i },
  { key: "sten", re: /\bsten\b|tegl|mursten/i },
  { key: "puds", re: /puds|filts|vandskur/i },
  { key: "brædder", re: /brædder|bræt|bræt|træ|planke/i },
  { key: "afdækning", re: /afdæk|presenning|overdæk/i },
  { key: "stillads", re: /stillads/i },
];

export function materialKeys() {
  return KEYWORDS.map((k) => k.key);
}

export function scanBehov(text: string): string[] {
  const raw = text.toLowerCase();
  const hits: string[] = [];
  for (const row of KEYWORDS) {
    if (row.re.test(raw) && !hits.includes(row.key)) hits.push(row.key);
  }
  return hits;
}

export function isMaterialNeed(text: string) {
  return /mangl|brug(?:er|er)? for|bestil|henter|afhent|lever|material/i.test(text) && scanBehov(text).length > 0
    ? true
    : scanBehov(text).length > 0 && /mangl|brug|skal bruge|løbet tør|ingen /i.test(text);
}

function corpusFor(projectId: string) {
  return UDBUD_CORPUS[projectId] ?? [];
}

function linesOf(text: string) {
  return text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

export function findProdukt(projectId: string, keyword: string): ProductHit {
  const files = corpusFor(projectId);
  const keyRe = KEYWORDS.find((k) => k.key === keyword)?.re ?? new RegExp(keyword, "i");
  const candidates: { hit: ProductHit; score: number }[] = [];
  for (const file of files) {
    for (const line of linesOf(file.text)) {
      if (!keyRe.test(line)) continue;
      const product = extractProduct(line, keyword);
      if (!product) continue;
      const hit: ProductHit = {
        keyword,
        found: true,
        product: product.name,
        spec: product.spec,
        cite: line.slice(0, 220),
        file: file.name,
      };
      candidates.push({ hit, score: scoreLine(line, keyword) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  if (candidates[0] && candidates[0].score > 0) return candidates[0].hit;
  return {
    keyword,
    found: false,
    product: "",
    spec: "",
    cite: "ikke i udbud — udfyld selv",
    file: "",
  };
}

function scoreLine(line: string, keyword: string) {
  let s = 1;
  if (/mørtel til opmuring/i.test(line)) s += 12;
  if (/mørtel opmuring/i.test(line)) s += 10;
  if (keyword === "mørtel" && /kc\s*50\s*\/\s*50\s*\/\s*700/i.test(line)) s += 8;
  if (keyword === "mørtel" && /kkh?\s*35\s*\/\s*65\s*\/\s*500/i.test(line)) s += 8;
  if (/forskelling|prøve:|vandskuring på/i.test(line)) s -= 6;
  return s;
}

function extractProduct(line: string, keyword: string) {
  const kc = line.match(/\b(KC|KKh)\s*(\d+\s*\/\s*\d+\s*\/\s*\d+)/i);
  if (kc) {
    return {
      name: `${kc[1]!.replace(/\s/g, "")} ${kc[2]!.replace(/\s/g, "")}`,
      spec: line.replace(/^[^:]*:\s*/, "").slice(0, 180),
    };
  }
  if (keyword === "isolering" && /stenuld/i.test(line)) {
    const lam = line.match(/λD\s*=\s*[\d.,]+\s*mW\/mK/i);
    return {
      name: "Stenuld hulmursisolering",
      spec: lam ? `${lam[0]}. Type: Stenuld.` : "Type: Stenuld. Indblæses udefra.",
    };
  }
  if (keyword === "bindere" && /binder/i.test(line)) {
    const dim = line.match(/Ø?\s*4\s*mm[^.]{0,40}/i);
    return {
      name: "Renoveringsbindere rustfrit stål Ø4 mm",
      spec: dim ? dim[0] : "Min. 4 stk. pr. m². Selvskærende gevind.",
    };
  }
  if (keyword === "sten" && /tegl|mursten|maskinsten/i.test(line)) {
    return {
      name: line.match(/hårdtbrændt[^.]{0,40}|røde massive maskinsten|massiv teglsten/i)?.[0] ?? "Mursten som eksisterende",
      spec: line.slice(0, 180),
    };
  }
  if (keyword === "puds" && /puds|filts|vandskur/i.test(line)) {
    const name = line.match(/KC\s*\d+\s*\/\s*\d+\s*\/\s*\d+|slutpuds[^.]{0,40}|grundpuds[^.]{0,40}/i)?.[0] ?? "";
    if (!name) return null;
    return { name: name.trim(), spec: line.slice(0, 180) };
  }
  if (keyword === "stillads" && /stillads|HAKI/i.test(line)) {
    return {
      name: "Stillads (HAKI)",
      spec: "Leveres og flyttes af HAKI. Zenko rører ikke fodplader.",
    };
  }
  if (keyword === "mørtel") {
    const named = line.match(/hydraulisk kalkmørtel[^,.]{0,40}|kalkmørtel[^,.]{0,40}/i);
    if (named) {
      return {
        name: named[0].trim(),
        spec: line.replace(/^[^:]*:\s*/, "").slice(0, 180),
      };
    }
  }
  return null;
}

export function findProdukter(projectId: string, keywords: string[]): ProductHit[] {
  const keys = keywords.length ? keywords : [];
  return keys.map((k) => findProdukt(projectId, k));
}

export function matchModtagelse(orderedProduct: string, orderedQty: number, seenProduct: string, seenQty: number | null) {
  const productOk = sameProduct(orderedProduct, seenProduct);
  const qtyOk = seenQty == null || orderedQty <= 0 || seenQty === orderedQty;
  const warnings: string[] = [];
  if (seenProduct && !productOk) warnings.push(`Du bestilte ${orderedProduct}, billedet viser ${seenProduct}`);
  if (!qtyOk) warnings.push(`bestilte ${orderedQty}, foto viser ${seenQty}`);
  return {
    ok: productOk && qtyOk,
    warning: warnings.join(". ") || "",
  };
}

function mortarCode(s: string) {
  const m = s.match(/\b(?:kc|kkh)\s*\d+\s*\/\s*\d+\s*\/\s*\d+/i);
  return m ? m[0].replace(/\s+/g, "").toLowerCase() : "";
}

function sameProduct(ordered: string, seen: string) {
  if (!seen.trim()) return true;
  const ca = mortarCode(ordered);
  const cb = mortarCode(seen);
  if (ca && cb) return ca === cb;
  if (/weber/i.test(seen) && !/weber/i.test(ordered)) return false;
  const a = norm(ordered);
  const b = norm(seen);
  if (a.includes(b) || b.includes(a)) return true;
  const words = b.split(" ").filter((w) => w.length > 3 && !/^\d+$/.test(w));
  const ta = new Set(a.split(" ").filter((w) => w.length > 3));
  return words.length > 0 && words.every((w) => ta.has(w));
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9/]+/g, " ").trim();
}

export function guessFromPhotoNote(note: string) {
  const product = note.match(/\b((?:KC|KKh)\s*\d+\s*\/\s*\d+\s*\/\s*\d+|weber\s*\d+|stenuld|binder[e]?|tegl|presenning|brædder)\b/i)?.[0] ?? "";
  const withUnit = note.match(/\b(\d+)\s*(stk|sække|sæk|paller|palle|pk)\b/i);
  if (withUnit) return { product, qty: Number(withUnit[1]) };
  const productNums = new Set(product.match(/\d+/g) ?? []);
  const rest = note.replace(product, " ");
  const n = rest.match(/\b(\d+)\b/);
  if (n && !productNums.has(n[1]!)) return { product, qty: Number(n[1]) };
  return { product, qty: null as number | null };
}

export function orderLines(o: {
  product?: string;
  spec?: string;
  qty?: number;
  unit?: string;
  inUdbud?: boolean;
  cite?: string;
  lines?: MaterialLine[];
}): MaterialLine[] {
  if (o.lines?.length) return o.lines;
  if (o.product) {
    return [
      {
        product: o.product,
        spec: o.spec ?? "",
        qty: o.qty ?? 0,
        unit: o.unit ?? "stk",
        inUdbud: Boolean(o.inUdbud),
        cite: o.cite,
      },
    ];
  }
  return [];
}
