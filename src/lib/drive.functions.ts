// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import { ConnectorType, GoogleDriveTools } from "@/lib/app-data";
import { CLASS_TO_SLOT, CHAT_FOLDER_NAME, INBOX_FOLDER_NAME, LIN_TF_FOLDER_NAME, SAGER_ROOT_ID, BESKEDER_FOLDER_NAME, ORDERS_FOLDER_NAME, RECEIPTS_FOLDER_NAME, TODO_FOLDER_NAME, PLADS_FOLDER_NAME, ERFARING_FOLDER_NAME, DAGSRAPPORT_FOLDER_NAME, AS_FOLDER_NAME, ER_FOLDER_NAME, KS_REPORTS_FOLDER_NAME, driveFor, rememberDrive, type DriveMap, type DriveSlot } from "./drive";
import { answerDocs, docTokens } from "./seed";
import { isKsImage } from "./ks-drive";
import { UDBUD_CORPUS, ISLEV_UDBUD_FILES } from "./udbud-corpus";
import { isMurerFile, rememberUdbudPlan, scanFromText, bundledUdbudScan } from "./udbud-plan";
import { grokChat, grokChatWeb } from "./grok-chat";
import { expandQueryWords } from "./udbud-synonyms";
import { isSupabaseFile, sbFileSrc, sbSafeSegment } from "./supabase";
import { sbUploadBase64 } from "./supabase-admin.server";

var ADMIN_NAME = "00 Admin";
var KNOWN_UDBUD = {
  "job-hillerodsholm": [
    {
      id: "1qqgrBf5L5qx2nyAq_vfoq2qc5TR6qpxD",
      name: "K01_C08_002_Murer.pdf"
    },
    {
      id: "1brLAo-sag0V0fEflfN7KeNJlsuFhynaq",
      name: "K01_C08_000_03_Stillads.pdf"
    },
    {
      id: "10LoQ3wF8qZOrKG17PCy-CVbS5LnCIRRq",
      name: "K01_C08_000_02_Byggeplads.pdf"
    },
    {
      id: "1rsqQDtK9g5QrgcmshX7ap2sOxHjfXIDx",
      name: "K01_C08_000_BSB .pdf"
    },
    {
      id: "1eOSDjLiMw9sohPCfQY-6Fkp1x0g-oN_Z",
      name: "K01_C08_001_Tømrer.pdf"
    },
    {
      id: "12-RXSHbkE5CtErRWcAhn6DcQSIJI-3bO",
      name: "K00_C08_Tilbudsliste.xlsx"
    }
  ],
  "job-islevvaenge": ISLEV_UDBUD_FILES.map((f) => ({
    id: f.id,
    name: f.name
  })),
  "job-kaerhuset": [{
    id: "1XbOwNs-GgYg2Ry6KBs7o2BpP4k3JvoZn",
    name: "11ARBE~1- murer arbejde.PDF"
  }]
};
var UDBUD_DOC_FOLDERS = { "job-hillerodsholm": [
  "1I7YPwKHKZK9fQDePTBmrwsO-Jdmn4g2I",
  "1vtCEJXLrwWhwzXClLeaSG14kKse7nAJB",
  "1s0sFdWNBbDYf44aSBkXowA62AegOkE7x"
] };
function filesFrom(data) {
  const rows = Array.isArray(data) ? data : data && typeof data === "object" ? data.files ?? data.items ?? data.documents ?? [] : [];
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const o = row;
    const id = String(o.id ?? o.file_id ?? o.folder_id ?? "");
    const name = String(o.name ?? o.title ?? "");
    const mime = String(o.mimeType ?? o.mime ?? o.mime_type ?? "");
    const folder = Boolean(o.is_folder) || mime.includes("folder");
    const modified = String(o.modified_time ?? o.modifiedTime ?? "");
    const bytes = typeof o.size_bytes === "number" ? o.size_bytes : undefined;
    if (id && name) out.push({
      id,
      name,
      mime: mime || undefined,
      folder,
      modified: modified || undefined,
      bytes
    });
  }
  if (!out.length && data && typeof data === "object") {
    const o = data;
    const id = String(o.id ?? o.folder_id ?? "");
    const name = String(o.name ?? "");
    if (id) out.push({
      id,
      name: name || ADMIN_NAME
    });
  }
  return out;
}
function isFolder(f) {
  return Boolean(f.folder) || (f.mime ?? "").includes("folder");
}
function mergeFiles(rows) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const f of rows) {
    if (!f.id || seen.has(f.id) || isFolder(f)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}
function textFrom(data) {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return "";
  const o = data;
  for (const k of [
    "content",
    "text",
    "markdown",
    "body",
    "excerpt",
    "extracted_text",
    "extractedText"
  ]) {
    const v = o[k];
    if (typeof v === "string" && v.trim().length > 20) return v;
  }
  if (o.file && typeof o.file === "object") return textFrom(o.file);
  if (o.data && typeof o.data === "object") return textFrom(o.data);
  return "";
}
function scoreFile(name, words) {
  const n = name.toLowerCase();
  let score = 0;
  if (/\.pdf$|\.docx$|\.doc$|\.txt$/.test(n)) score += 2;
  if (/udbud|k01|murer|kontrol|ukp|beskriv/.test(n)) score += 6;
  for (const w of words) if (n.includes(w)) score += 4;
  return score;
}
var listCache = /* @__PURE__ */ new Map();
var askCache = /* @__PURE__ */ new Map();
var LIST_TTL = 300_000;
var ASK_TTL = 600_000;
var textCache = /* @__PURE__ */ new Map();
var TEXT_TTL = 30 * 60_000;
function race(p, ms, fallback) {
  let timer;
  return Promise.race([p.finally(() => {
    if (timer) clearTimeout(timer);
  }), new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  })]);
}
const DA_TOKEN = "Google er ikke forbundet. Åbn appen fra Grok (preview), eller log ind.";
async function tokenMissing() {
  try {
    const { getConnectorAccessToken } = await import("@/lib/app-data/client.server");
    return !getConnectorAccessToken();
  } catch {
    return true;
  }
}
async function listProjectUdbud(projectId) {
  const cached = listCache.get(projectId);
  if (cached && Date.now() - cached.at < LIST_TTL) return cached.value;
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const map = driveFor(projectId);
  const folderIds = [...UDBUD_DOC_FOLDERS[projectId] ?? [], map?.udbud].filter(Boolean);
  const collected = [...KNOWN_UDBUD[projectId] ?? []];
  let loginRequired = false;
  let loginUrl;
  let error;
  const listed = await Promise.all(folderIds.slice(0, 4).map((folder_id) => race(callTool(GoogleDriveTools.listFolder, {
    folder_id,
    max_results: 80
  }, opts), 4500, {
    ok: false,
    data: null,
    errorMessage: "timeout",
    loginRequired: false
  })));
  for (const row of listed) {
    if (row.loginRequired) {
      loginRequired = true;
      loginUrl = row.loginUrl ?? loginUrl;
    }
    if (!row.ok) {
      error = row.errorMessage ?? error;
      continue;
    }
    const rows = filesFrom(row.data);
    collected.push(...rows.filter((f) => !isFolder(f)));
    const docs = rows.filter((f) => isFolder(f) && /hoved|tilbud|aftale|rettelse|udbudsbrev|dokumentliste/i.test(f.name)).slice(0, 4);
    for (const sub of docs) {
      const nested = await race(callTool(GoogleDriveTools.listFolder, {
        folder_id: sub.id,
        max_results: 80
      }, opts), 4000, {
        ok: false,
        data: null,
        errorMessage: "timeout",
        loginRequired: false
      });
      if (nested.ok) collected.push(...filesFrom(nested.data).filter((f) => !isFolder(f)));
      else if (nested.loginRequired) {
        loginRequired = true;
        loginUrl = nested.loginUrl ?? loginUrl;
      }
    }
  }
  const files = mergeFiles(collected);
  const value = {
    files,
    loginRequired: loginRequired || undefined,
    loginUrl,
    error
  };
  if (files.length) listCache.set(projectId, {
    at: Date.now(),
    value
  });
  return value;
}
async function readDriveFile(fileId) {
  const hit = textCache.get(fileId);
  if (hit && Date.now() - hit.at < TEXT_TTL) return hit.text;
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const read = await race(callTool(GoogleDriveTools.readFile, {
    file_id: fileId,
    max_chars: 28000
  }, opts), 9000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  if (!read.ok) return "";
  const text = textFrom(read.data);
  if (text.trim().length > 40) {
    textCache.set(fileId, {
      at: Date.now(),
      text
    });
    return text;
  }
  return "";
}
function snippetFrom(text, words) {
  if (!text || !words.length) return null;
  const scored = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p.length > 40).map((p) => {
    const low = p.toLowerCase();
    let s = 0;
    for (const w of words) if (low.includes(w)) s += w.length >= 5 ? 3 : 1;
    return {
      p,
      s
    };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!scored.length) return null;
  return scored.slice(0, 3).map((x) => x.p).join(" ").slice(0, 900);
}
function corpusFor(projectId, name) {
  const rows = UDBUD_CORPUS[projectId] ?? [];
  return (rows.find((r) => r.name.toLowerCase() === name.toLowerCase()) ?? rows.find((r) => name.toLowerCase().includes(r.name.replace(/\.pdf$/i, "").toLowerCase().slice(0, 12))))?.text ?? "";
}
async function grokFromFiles(query, files, history) {
  const packed = files.map((f) => `### ${f.name}\n${f.text.slice(0, 9000)}`).join("\n\n").slice(0, 16000);
  if (packed.length < 80) return null;
  return grokChat({
    system: "Du er Zenko Danmarks udbuds-bot for murermester Ole. Du har læst 01 Udbudsmateriale på Google Drive. Svar på dansk, konkret og hjælpsom — som en der har papirerne foran sig. Citér filnavn og punktnummer (fx 10.02.02). Giv materialer, mængder, krav og undtagelser. Hvis mester følger op, husk samtalen. Hvis det ikke står i uddraget, sig det ærligt og peg på hvilken fil der ellers bør åbnes. Ingen indledning, ingen markdown-overskrifter.",
    user: `Spørgsmål: ${query.slice(0, 600)}\n\nUdbud:\n${packed}`,
    history,
    maxTokens: 700,
    timeoutMs: 20000
  });
}
export const listUdbudFiles = createServerFn({ method: "POST" }).validator((input: { projectId: string }) => input).handler(async ({ data }) => {
  const listed = await listProjectUdbud(data.projectId);
  return {
    ok: true,
    files: listed.files.map((f) => ({
      id: f.id,
      name: f.name
    })),
    loginRequired: listed.loginRequired,
    loginUrl: listed.loginUrl,
    error: listed.error
  };
});
export const askUdbud = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const query = data.query.trim();
  const history = data.history ?? [];
  const cacheKey = history.length ? "" : `${data.projectId}::${query.toLowerCase()}`;
  if (cacheKey) {
    const hit = askCache.get(cacheKey);
    if (hit && Date.now() - hit.at < ASK_TTL) return hit.value;
  }
  const listed = await listProjectUdbud(data.projectId);
  const files = listed.files.map((f) => ({
    id: f.id,
    name: f.name
  }));
  const local = answerDocs(query, data.projectId);
  const empty = {
    ok: true,
    line: local?.line ?? null,
    source: local ? "plan" : null,
    files,
    used: [],
    loginRequired: listed.loginRequired,
    loginUrl: listed.loginUrl
  };
  if (!query) return empty;
  const words = expandQueryWords(docTokens(query));
  const corpus = UDBUD_CORPUS[data.projectId] ?? [];
  const ranked = [...listed.files].sort((a, b) => {
    const ta = corpusFor(data.projectId, a.name);
    const tb = corpusFor(data.projectId, b.name);
    return scoreFile(b.name, words) + scoreText(tb, words) - (scoreFile(a.name, words) + scoreText(ta, words));
  });
  const picks = ranked.filter((f) => scoreFile(f.name, words) + scoreText(corpusFor(data.projectId, f.name), words) > 0).slice(0, 4);
  const chosen = picks.length ? picks : ranked.slice(0, 3);
  const extracted = [];
  const seen = /* @__PURE__ */ new Set();
  const skipLive = Boolean(listed.loginRequired);
  for (const file of chosen) {
    let text = "";
    let live = false;
    if (!skipLive) try {
      text = await readDriveFile(file.id);
      if (text) live = true;
    } catch {}
    if (!text) text = corpusFor(data.projectId, file.name);
    if (text && !seen.has(file.name)) {
      seen.add(file.name);
      extracted.push({
        name: file.name,
        text,
        live
      });
    }
  }
  for (const row of corpus) {
    if (seen.has(row.name)) continue;
    if (!words.length || words.some((w) => row.text.toLowerCase().includes(w) || row.name.toLowerCase().includes(w))) {
      seen.add(row.name);
      extracted.push({
        name: row.name,
        text: row.text,
        live: false
      });
    }
  }
  if (!extracted.length && corpus.length) for (const row of corpus) extracted.push({
    name: row.name,
    text: row.text,
    live: false
  });
  const packed = extracted.map((f) => ({
    name: f.name,
    text: f.text
  }));
  const grok = packed.length ? await grokFromFiles(query, packed, history) : null;
  const snip = packed.map((f) => snippetFrom(f.text, words)).find(Boolean) ?? null;
  const driveLine = grok || snip || local?.line || null;
  const used = extracted.map((f) => f.name);
  const value = driveLine ? {
    ok: true,
    line: driveLine,
    source: grok || snip ? "drive" : local ? "plan" : null,
    files,
    used,
    loginRequired: listed.loginRequired,
    loginUrl: listed.loginUrl
  } : empty;
  if (value.source === "drive" && cacheKey) askCache.set(cacheKey, {
    at: Date.now(),
    value
  });
  return value;
});
export const scanUdbudPlan = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const bundled = bundledUdbudScan(data.projectId);
  const listed = await listProjectUdbud(data.projectId);
  const murer = listed.files.filter((f) => isMurerFile(f.name));
  let fileName = murer[0]?.name ?? bundled?.fileName ?? "";
  let text = "";
  if (murer[0]?.id) text = await readDriveFile(murer[0].id);
  if (text.trim().length < 80) {
    const local = (UDBUD_CORPUS[data.projectId] ?? []).find((r) => isMurerFile(r.name));
    if (local) {
      text = local.text;
      fileName = fileName || local.name;
    }
  }
  let scan = text.trim().length >= 40 ? scanFromText(data.projectId, fileName, text) : {
    projectId: data.projectId,
    fileName: "",
    found: false,
    parts: [],
    meta: {
      name: "",
      client: "",
      address: "",
      scope: ""
    },
    scannedAt: (new Date()).toISOString()
  };
  if (!scan.parts.length && bundled?.parts.length) scan = {
    ...bundled,
    scannedAt: (new Date()).toISOString()
  };
  scan.found = Boolean(scan.fileName);
  rememberUdbudPlan(scan);
  try {
    const { getSql } = await import("@/lib/db");
    await (await getSql()).query(`insert into ks_customer_jobs (slug, project_id, payload, updated_at)
         values ($1, $2, $3::jsonb, now())
         on conflict (slug) do update set
           project_id = excluded.project_id,
           payload = excluded.payload,
           updated_at = now()`, [
      data.slug,
      data.projectId,
      JSON.stringify({
        plan: scan.parts,
        fileName: scan.fileName,
        scannedAt: scan.scannedAt,
        meta: scan.meta
      })
    ]);
  } catch {}
  return {
    ok: true,
    found: scan.found,
    fileName: scan.fileName,
    parts: scan.parts,
    meta: scan.meta,
    scannedAt: scan.scannedAt,
    count: scan.parts.length,
    loginRequired: listed.loginRequired,
    loginUrl: listed.loginUrl
  };
});
function scoreText(text, words) {
  if (!text || !words.length) return 0;
  const low = text.toLowerCase();
  let s = 0;
  for (const w of words) if (low.includes(w)) s += w.length >= 5 ? 3 : 1;
  return s;
}
export const ensureAdminLog = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  let folderId = "";
  const listed = await callTool(GoogleDriveTools.listFolder, { folder_id: SAGER_ROOT_ID }, opts);
  if (listed.ok) {
    const found = filesFrom(listed.data).find((f) => f.name === ADMIN_NAME || f.name.toLowerCase() === "admin");
    if (found) folderId = found.id;
  }
  if (!folderId) {
    const searched = await callTool(GoogleDriveTools.search, { query: ADMIN_NAME }, opts);
    if (searched.ok) {
      const found = filesFrom(searched.data).find((f) => f.name.includes("Admin") || f.name.includes("admin"));
      if (found) folderId = found.id;
    }
  }
  if (!folderId) {
    const created = await callTool(GoogleDriveTools.createFolder, {
      name: ADMIN_NAME,
      parent_id: SAGER_ROOT_ID
    }, opts);
    if (created.ok) {
      folderId = filesFrom(created.data)[0]?.id ?? "";
      if (!folderId && created.data && typeof created.data === "object") folderId = String(created.data.id ?? "");
    }
  }
  if (!folderId) return {
    ok: false,
    error: listed.errorMessage ?? "Drive Admin ikke oprettet",
    loginRequired: listed.loginRequired
  };
  const wrote = await callTool("google_drive_create_file", {
    name: `plads-log-${data.date}.txt`,
    parent_id: folderId,
    content: data.text.slice(0, 12000),
    mimeType: "text/plain"
  }, opts) ?? {
    ok: false,
    data: null,
    errorMessage: "no write"
  };
  return {
    ok: true,
    folderId,
    wrote: Boolean(wrote.ok),
    writeError: wrote.ok ? undefined : wrote.errorMessage
  };
});
export const snapshotYardToAdmin = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  let folderId = "";
  const listed = await callTool(GoogleDriveTools.listFolder, { folder_id: SAGER_ROOT_ID }, opts);
  if (listed.ok) {
    const found = filesFrom(listed.data).find((f) => f.name === ADMIN_NAME || f.name.toLowerCase() === "admin");
    if (found) folderId = found.id;
  }
  if (!folderId) {
    const created = await callTool(GoogleDriveTools.createFolder, {
      name: ADMIN_NAME,
      parent_id: SAGER_ROOT_ID
    }, opts);
    if (created.ok) folderId = idFrom(created.data);
  }
  if (!folderId) return {
    ok: false,
    error: "00 Admin mangler",
    loginRequired: listed.loginRequired
  };
  const wrote = await race(callTool("google_drive_create_file", {
    name: `zenko-live-${data.at.slice(0, 13).replace("T", "_")}.json`,
    parent_id: folderId,
    mimeType: "application/json",
    content: data.json.slice(0, 450000)
  }, opts), 10000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  return {
    ok: Boolean(wrote.ok),
    folderId,
    loginRequired: wrote.loginRequired ?? listed.loginRequired
  };
});
export const saveWeekPlan = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  let adminId = "";
  const listed = await callTool(GoogleDriveTools.listFolder, { folder_id: SAGER_ROOT_ID }, opts);
  if (listed.ok) {
    const found = filesFrom(listed.data).find((f) => f.name === ADMIN_NAME || f.name.toLowerCase() === "admin");
    if (found) adminId = found.id;
  }
  if (!adminId) {
    const created = await callTool(GoogleDriveTools.createFolder, {
      name: ADMIN_NAME,
      parent_id: SAGER_ROOT_ID
    }, opts);
    if (created.ok) adminId = idFrom(created.data);
  }
  if (!adminId) return {
    ok: false,
    error: "00 Admin mangler",
    loginRequired: listed.loginRequired
  };
  let planId = "";
  const kids = await callTool(GoogleDriveTools.listFolder, {
    folder_id: adminId,
    max_results: 40
  }, opts);
  if (kids.ok) {
    const hit = filesFrom(kids.data).find((f) => f.name === "Plan" || f.name.toLowerCase() === "plan");
    if (hit) planId = hit.id;
  }
  if (!planId) {
    const made = await callTool(GoogleDriveTools.createFolder, {
      name: "Plan",
      parent_id: adminId
    }, opts);
    if (made.ok) planId = idFrom(made.data);
  }
  if (!planId) return {
    ok: false,
    error: "Plan-mappe mangler",
    loginRequired: kids.loginRequired ?? listed.loginRequired
  };
  const name = `uge-${data.week}-${data.weekStart}.txt`;
  const wrote = await race(callTool("google_drive_create_file", {
    name,
    parent_id: planId,
    mimeType: "text/plain",
    content: data.text.slice(0, 20000)
  }, opts), 10000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  return {
    ok: Boolean(wrote.ok),
    folderId: planId,
    fileName: name,
    loginRequired: wrote.loginRequired ?? listed.loginRequired
  };
});
export async function resolveJobOrAdminRoot(projectId, projectName) {
  const mapped = driveFor(projectId)?.root ?? "";
  if (mapped) return { id: mapped };
  const name = String(projectName || "").trim();
  const wantAdmin = !projectId || sameFolderName(name, ADMIN_NAME) || name.toLowerCase() === "admin" || String(projectId) === "admin";
  if (!wantAdmin && name) {
    const ens = await ensureSagFolders({ data: { projectId, name } });
    if (ens.ok && ens.rootId) return { id: ens.rootId, loginRequired: ens.loginRequired };
    return { id: "", loginRequired: ens.loginRequired, error: ens.error ?? "Ingen sag-mappe i Drive" };
  }
  if (!wantAdmin) return { id: "", error: "Ingen sag-mappe i Drive" };
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const listed = await callTool(GoogleDriveTools.listFolder, { folder_id: SAGER_ROOT_ID }, opts);
  if (listed.ok) {
    const found = filesFrom(listed.data).find((f) => f.name === ADMIN_NAME || f.name.toLowerCase() === "admin");
    if (found) return { id: found.id, loginRequired: listed.loginRequired };
  }
  const created = await callTool(GoogleDriveTools.createFolder, {
    name: ADMIN_NAME,
    parent_id: SAGER_ROOT_ID
  }, opts);
  const id = created.ok ? idFrom(created.data) : "";
  return {
    id,
    loginRequired: created.loginRequired ?? listed.loginRequired,
    error: id ? undefined : "00 Admin mangler"
  };
}
export const writeJobNote = createServerFn({ method: "POST" }).validator((input: { projectId: string; folderName: string; name: string; text: string; projectName?: string }) => input).handler(async ({ data }) => {
  if (await tokenMissing()) return { ok: false as const, fileId: "", error: DA_TOKEN, loginRequired: true };
  const run = (async () => {
    const folder = await resolveJobFolder(data.projectId, data.projectName, data.folderName);
    const folderId = folder.id;
    if (!folderId) return { ok: false as const, fileId: "", error: folder.error || "Ingen Drive-mappe", loginRequired: folder.loginRequired };
    const { callTool } = await import("@/lib/app-data/client.server");
    const opts = { connectorType: ConnectorType.GoogleDrive };
    const wrote = await race(callTool("google_drive_create_file", {
      name: data.name,
      parent_id: folderId,
      mimeType: "text/plain",
      content: data.text.slice(0, 40000)
    }, opts), 8000, {
      ok: false,
      data: null,
      errorMessage: "timeout"
    });
    const fileId = wrote.ok ? idFrom(wrote.data) : "";
    return {
      ok: Boolean(fileId),
      fileId,
      folderId,
      loginRequired: wrote.loginRequired || folder.loginRequired,
      error: fileId ? undefined : (wrote.errorMessage || "Drive svarede ikke. Prøv igen.")
    };
  })();
  return race(run, 12000, {
    ok: false as const,
    fileId: "",
    error: "Drive svarede ikke. Prøv igen."
  });
});
export const listKsPhotos = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const folderId = driveFor(data.projectId)?.ks ?? "";
  if (!folderId) return {
    ok: true,
    files: [],
    loginRequired: false
  };
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const listed = await race(callTool(GoogleDriveTools.listFolder, {
    folder_id: folderId,
    max_results: 200
  }, opts), 8000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  if (!listed.ok) return {
    ok: true,
    files: [],
    loginRequired: listed.loginRequired,
    error: listed.errorMessage
  };
  return {
    ok: true,
    files: mergeFiles(filesFrom(listed.data)).filter((f) => isKsImage(f.name, f.mime)).map((f) => ({
      id: f.id,
      name: f.name
    })),
    loginRequired: listed.loginRequired
  };
});
export const listDriveContents = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  if (!data.folderId) return {
    ok: true,
    items: [],
    loginRequired: false
  };
  const { callTool } = await import("@/lib/app-data/client.server");
  const listed = await race(callTool(GoogleDriveTools.listFolder, {
    folder_id: data.folderId,
    max_results: 200
  }, { connectorType: ConnectorType.GoogleDrive }), 8000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  if (!listed.ok) return {
    ok: false,
    items: [],
    loginRequired: listed.loginRequired,
    error: listed.errorMessage
  };
  return {
    ok: true,
    items: filesFrom(listed.data).sort((a, b) => Number(isFolder(b)) - Number(isFolder(a)) || a.name.localeCompare(b.name, "da")),
    loginRequired: listed.loginRequired
  };
});
function idFrom(data) {
  const files = filesFrom(data);
  if (files[0]?.id) return files[0].id;
  if (data && typeof data === "object") {
    const o = data;
    return String(o.id ?? o.folder_id ?? o.file_id ?? "");
  }
  return "";
}
var inboxCache = /* @__PURE__ */ new Map();
async function findOrCreateNamedFolder(parentId, name) {
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const listed = await race(callTool(GoogleDriveTools.listFolder, { folder_id: parentId }, opts), 8000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  if (listed.ok) {
    const found = filesFrom(listed.data).find((f) => f.name === name || f.name.toLowerCase().includes("indbakke") || f.name.toLowerCase().includes("felt"));
    if (found) return {
      id: found.id,
      loginRequired: listed.loginRequired
    };
  }
  const created = await race(callTool(GoogleDriveTools.createFolder, {
    name,
    parent_id: parentId
  }, opts), 8000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  if (created.ok) {
    const id = idFrom(created.data);
    if (id) return {
      id,
      loginRequired: created.loginRequired
    };
  }
  return {
    id: "",
    loginRequired: listed.loginRequired || created.loginRequired,
    error: created.errorMessage ?? listed.errorMessage
  };
}
export const ensureInboxFolder = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const cached = inboxCache.get(data.projectId);
  if (cached && Date.now() - cached.at < 30 * 60_000 && cached.id) return {
    ok: true,
    folderId: cached.id
  };
  const root = driveFor(data.projectId)?.root ?? "";
  if (!root) return {
    ok: false,
    error: "Ingen sag-mappe"
  };
  const found = await findOrCreateNamedFolder(root, INBOX_FOLDER_NAME);
  if (!found.id) return {
    ok: false,
    error: found.error ?? "Kunne ikke oprette indbakke",
    loginRequired: found.loginRequired
  };
  inboxCache.set(data.projectId, {
    at: Date.now(),
    id: found.id
  });
  return {
    ok: true,
    folderId: found.id
  };
});
export const uploadFieldToDrive = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  let folderId = data.folderId ?? "";
  if (!folderId) {
    const ensured = await ensureInboxFolder({ data: { projectId: data.projectId } });
    if (!ensured.ok) return {
      ok: false,
      error: ensured.error,
      loginRequired: ensured.loginRequired
    };
    folderId = ensured.folderId;
  }
  const wrote = await race(callTool("google_drive_create_file", {
    name: `felt-${(new Date()).toISOString().slice(0, 16).replace("T", "_").replace(":", "")}-${data.name.replace(/[^\w.\-æøåÆØÅ ]+/g, "_").slice(0, 60)}.txt`,
    parent_id: folderId,
    mimeType: "text/plain",
    content: data.text.slice(0, 12000)
  }, opts), 10000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  const fileId = wrote.ok ? idFrom(wrote.data) : "";
  return {
    ok: true,
    folderId,
    fileId,
    wrote: Boolean(wrote.ok),
    writeError: wrote.ok ? undefined : wrote.errorMessage,
    loginRequired: wrote.loginRequired
  };
});
export const placeFieldInSlot = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const slot = CLASS_TO_SLOT[data.classifiedAs];
  const folderId = driveFor(data.projectId)?.[slot] ?? "";
  if (!folderId) return {
    ok: false,
    error: "Ingen Drive-mappe for typen"
  };
  const label = data.classifiedAs === "materials" ? "BESTILLING" : data.classifiedAs === "extra" ? "EKSTRA" : data.classifiedAs === "tf" ? "TF" : data.classifiedAs === "ks" ? "KS" : "ENT";
  const wrote = await race(callTool("google_drive_create_file", {
    name: `${label}-${(new Date()).toISOString().slice(0, 10)}-${data.name.replace(/[^\w.\-æøåÆØÅ ]+/g, "_").slice(0, 50)}.txt`,
    parent_id: folderId,
    mimeType: "text/plain",
    content: [
      "ZENKO PLADS — feltfil til rapport",
      `Type: ${label}`,
      `Sag: ${data.projectId}`,
      `Ansat: ${data.employeeName}`,
      `Fil: ${data.name}`,
      data.reportNumber ? `Rapport: ${data.reportNumber}` : "",
      `Note: ${data.note}`,
      "Ikke sendt. I henter filen herfra og vedhæfter selv."
    ].filter(Boolean).join("\n")
  }, opts), 10000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  return {
    ok: true,
    folderId,
    fileId: wrote.ok ? idFrom(wrote.data) : "",
    wrote: Boolean(wrote.ok),
    writeError: wrote.ok ? undefined : wrote.errorMessage
  };
});
export const uploadKsPhotoToDrive = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const slug = sbSafeSegment(data.projectName || data.projectId || "sag");
  const point = sbSafeSegment(data.point || "div");
  const name = sbSafeSegment(String(data.name || `foto-${Date.now()}.jpg`).replace(/\s+/g, "-"));
  const path = `sager/${slug}/ks/${point}/${name}`;
  const plads = await sbUploadBase64(path, data.contentBase64, data.mimeType || "image/jpeg");
  if (plads.ok) {
    return {
      ok: true,
      fileId: plads.url,
      folderId: "plads",
      wrote: true,
      writeError: undefined
    };
  }
  const rel = String(data.folderName || "").replace(/^05 Rapporter\/?/i, "");
  const drivePath = rel ? `${KS_REPORTS_FOLDER_NAME}/${rel}` : KS_REPORTS_FOLDER_NAME;
  const folder = await resolveJobFolder(data.projectId, data.projectName, drivePath);
  const folderId = folder.id;
  if (!folderId) return {
    ok: false,
    error: folder.error ?? "Ingen 05 Rapporter-mappe på sagen",
    fileId: "",
    folderId: "",
    loginRequired: folder.loginRequired
  };
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const wrote = await race(callTool("google_drive_create_file", {
    name: data.name,
    parent_id: folderId,
    mimeType: data.mimeType || "image/jpeg",
    content: data.contentBase64,
    content_base64: data.contentBase64
  }, opts), 20000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  const fileId = wrote.ok ? idFrom(wrote.data) : "";
  if (!fileId) {
    return {
      ok: false,
      fileId: "",
      folderId,
      wrote: false,
      writeError: wrote.errorMessage,
      loginRequired: wrote.loginRequired,
      loginUrl: wrote.loginUrl,
      error: wrote.errorMessage ?? "Drive tog ikke imod billedet"
    };
  }
  return {
    ok: true,
    fileId,
    folderId,
    wrote: true,
    writeError: undefined,
    loginRequired: wrote.loginRequired,
    loginUrl: wrote.loginUrl
  };
});
export const writeKsReportSidecar = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const rel = String(data.folderName || [data.point, data.number].filter(Boolean).join("/")).replace(/^05 Rapporter\/?/i, "");
  const path = rel ? `${KS_REPORTS_FOLDER_NAME}/${rel}` : KS_REPORTS_FOLDER_NAME;
  const folder = await resolveJobFolder(data.projectId, data.projectName, path);
  if (!folder.id) return {
    ok: false,
    error: folder.error || "Ingen KS-mappe",
    fileId: "",
    loginRequired: folder.loginRequired
  };
  const { callTool } = await import("@/lib/app-data/client.server");
  const body = [
    "ZENKO PLADS — KS-rapport",
    `Nr: ${data.number}`,
    `Punkt: ${data.point} ${data.title}`,
    `Sag: ${data.projectId}`,
    data.employeeName ? `Ansat: ${data.employeeName}` : "",
    data.location ? `Lokation: ${data.location}` : "",
    `Afvigelser: ${data.deviations}`,
    "Fotos:",
    ...data.names.map((n) => `- ${n}`),
    data.meta ? `\n${data.meta}` : "",
    `Gemt i 05 Rapporter/${rel || data.point || ""} på Google Drive.`
  ].filter((line) => line !== "").join("\n");
  const wrote = await race(callTool("google_drive_create_file", {
    name: `KS-${data.number}-${data.point}.txt`,
    parent_id: folder.id,
    mimeType: "text/plain",
    content: body.slice(0, 20000)
  }, { connectorType: ConnectorType.GoogleDrive }), 10000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  return {
    ok: Boolean(wrote.ok),
    fileId: wrote.ok ? idFrom(wrote.data) : "",
    loginRequired: wrote.loginRequired || folder.loginRequired,
    error: wrote.ok ? undefined : (wrote.errorMessage || "Drive tog ikke imod filen")
  };
});
function imageFrom(data) {
  if (!data) return "";
  if (typeof data === "string") {
    const s = data.trim();
    if (s.startsWith("data:image")) return s;
    if (s.startsWith("http") && /googleusercontent|thumbnail|lh3|google\.com\/uc/.test(s)) return s;
    return "";
  }
  if (typeof data !== "object") return "";
  const o = data;
  for (const k of [
    "data_url",
    "dataUrl",
    "thumbnail_url",
    "thumbnailUrl",
    "thumbnailLink",
    "thumbnail",
    "webContentLink",
    "download_url",
    "url"
  ]) {
    const v = o[k];
    if (typeof v === "string" && v.startsWith("data:image")) return v;
    if (typeof v === "string" && v.startsWith("http") && /image|thumbnail|googleusercontent|lh3|uc\?/.test(`${k} ${v}`)) return v;
  }
  for (const k of [
    "content_base64",
    "base64",
    "content"
  ]) {
    const v = o[k];
    if (typeof v === "string" && v.startsWith("data:image")) return v;
    if (typeof v === "string" && v.length > 400 && /^[A-Za-z0-9+/=\s]+$/.test(v.slice(0, 80))) return `data:image/jpeg;base64,${v.replace(/\s+/g, "")}`;
  }
  if (o.file) return imageFrom(o.file);
  if (o.data) return imageFrom(o.data);
  return "";
}
var imageCache = /* @__PURE__ */ new Map();
export const fetchKsImage = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const fileId = String(data.fileId || "");
  if (isSupabaseFile(fileId) || fileId.startsWith("http")) {
    const url = sbFileSrc(fileId) || fileId;
    if (url.startsWith("http")) {
      return { ok: true, dataUrl: url };
    }
  }
  const hit = imageCache.get(data.fileId);
  if (hit && Date.now() - hit.at < 600_000) return {
    ok: true,
    dataUrl: hit.dataUrl
  };
  const { callTool } = await import("@/lib/app-data/client.server");
  const read = await race(callTool(GoogleDriveTools.readFile, { file_id: data.fileId }, { connectorType: ConnectorType.GoogleDrive }), 12000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  if (!read.ok) return {
    ok: false,
    dataUrl: "",
    loginRequired: read.loginRequired,
    loginUrl: read.loginUrl,
    error: read.errorMessage
  };
  const dataUrl = imageFrom(read.data);
  if (dataUrl) imageCache.set(data.fileId, {
    at: Date.now(),
    dataUrl
  });
  return {
    ok: Boolean(dataUrl),
    dataUrl,
    loginRequired: read.loginRequired
  };
});
export const pushSoftrPhotoBatch = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const results = [];
  let loginRequired = false;
  for (const item of data.items.slice(0, 6)) {
    const full = path.join(process.cwd(), "public", item.rel.replace(/^\/+/, ""));
    let b64 = "";
    try {
      b64 = (await fs.readFile(full)).toString("base64");
    } catch {
      results.push({
        name: item.name,
        ok: false,
        fileId: ""
      });
      continue;
    }
    const wrote = await race(callTool("google_drive_create_file", {
      name: item.name,
      parent_id: item.folderId,
      mimeType: "image/jpeg",
      content: b64,
      content_base64: b64
    }, opts), 20000, {
      ok: false,
      data: null,
      errorMessage: "timeout"
    });
    if (wrote.loginRequired) loginRequired = true;
    results.push({
      name: item.name,
      ok: Boolean(wrote.ok && idFrom(wrote.data)),
      fileId: wrote.ok ? idFrom(wrote.data) : ""
    });
  }
  return {
    ok: results.some((r) => r.ok),
    results,
    loginRequired
  };
});
var SAG_TREE = [
  { slot: "udbud", name: "01 Udbudsmateriale" },
  { slot: "reports", name: "05 Rapporter" },
  { slot: "chat", name: CHAT_FOLDER_NAME },
  { name: TODO_FOLDER_NAME },
  { name: ORDERS_FOLDER_NAME },
  { name: RECEIPTS_FOLDER_NAME },
  { name: PLADS_FOLDER_NAME, parent: "udbud" },
  { name: ERFARING_FOLDER_NAME, parent: "udbud" },
  { name: DAGSRAPPORT_FOLDER_NAME, parent: "udbud" },
];
const UD_NEST = [PLADS_FOLDER_NAME, ERFARING_FOLDER_NAME, DAGSRAPPORT_FOLDER_NAME];
function sameFolderName(a, b) {
  return String(a || "").trim().toLowerCase().replace(/\s+/g, " ") === String(b || "").trim().toLowerCase().replace(/\s+/g, " ");
}
async function listChildren(parentId) {
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  return race(callTool(GoogleDriveTools.listFolder, { folder_id: parentId, max_results: 80 }, opts), 8000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
}
async function findExactChild(parentId, name) {
  const listed = await listChildren(parentId);
  if (listed.ok) {
    const rows = filesFrom(listed.data);
    const found = rows.find((f) => f.folder && sameFolderName(f.name, name))
      || rows.find((f) => sameFolderName(f.name, name));
    if (found) return { id: found.id, loginRequired: listed.loginRequired };
  }
  return { id: "", loginRequired: listed.loginRequired, error: listed.ok ? undefined : listed.errorMessage, listed: Boolean(listed.ok) };
}
async function findOrCreateExact(parentId, name) {
  const hit = await findExactChild(parentId, name);
  if (hit.id) return { id: hit.id, loginRequired: hit.loginRequired };
  if (hit.loginRequired) return { id: "", loginRequired: true, error: hit.error ?? "Drive-login" };
  if (!hit.listed) return { id: "", error: hit.error ?? "Kunne ikke læse Drive-mappe" };
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const created = await race(callTool(GoogleDriveTools.createFolder, {
    name,
    parent_id: parentId
  }, opts), 8000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  if (created.ok) {
    const id = idFrom(created.data);
    if (id) return { id, loginRequired: created.loginRequired };
  }
  return {
    id: "",
    loginRequired: hit.loginRequired || created.loginRequired,
    error: created.errorMessage ?? hit.error
  };
}

export async function ensureDriveFolderPath(rootId: string, folderName: string): Promise<{ id: string; loginRequired?: boolean; error?: string }> {
  const parts = folderName.split("/").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return { id: rootId };
  let current = rootId;
  let loginRequired: boolean | undefined;
  for (const part of parts) {
    const found = await findOrCreateExact(current, part);
    loginRequired = loginRequired || found.loginRequired;
    if (!found.id) return { id: "", loginRequired, error: found.error ?? `Mappe mangler: ${part}` };
    current = found.id;
  }
  return { id: current, loginRequired };
}

export async function resolveJobFolder(projectId: string, projectName: string | undefined, folderName: string): Promise<{ id: string; loginRequired?: boolean; error?: string }> {
  const rootHit = await resolveJobOrAdminRoot(projectId, projectName);
  const root = rootHit.id ?? "";
  if (!root) return { id: "", loginRequired: rootHit.loginRequired, error: rootHit.error || "Ingen Drive-mappe" };
  const map = driveFor(projectId);
  const parts = String(folderName || "").split("/").map((s) => s.trim()).filter(Boolean);
  const head = parts[0] || "";
  let base = root;
  let rest = parts;
  if (head === LIN_TF_FOLDER_NAME && map?.tf) {
    base = map.tf;
    rest = parts.slice(1);
  } else if (head === AS_FOLDER_NAME && map?.extra) {
    base = map.extra;
    rest = parts.slice(1);
  } else if (head === ER_FOLDER_NAME && map?.ent) {
    base = map.ent;
    rest = parts.slice(1);
  } else if (head === KS_REPORTS_FOLDER_NAME && map?.reports) {
    base = map.reports;
    rest = parts.slice(1);
  }
  const folder = await ensureDriveFolderPath(base, rest.join("/"));
  return { id: folder.id, loginRequired: folder.loginRequired || rootHit.loginRequired, error: folder.error };
}

export const ensureSagFolders = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const existing = data.known ?? driveFor(data.projectId);
  let rootId = existing?.root ?? "";
  let loginRequired;
  if (!rootId) {
    const root = await findOrCreateExact(SAGER_ROOT_ID, data.name);
    if (!root.id) return {
      ok: false,
      error: root.error ?? "Kunne ikke oprette sagsmappe",
      loginRequired: root.loginRequired
    };
    rootId = root.id;
    loginRequired = root.loginRequired;
  }
  const map = {
    root: rootId,
    udbud: existing?.udbud ?? "",
    ks: existing?.ks ?? "",
    kunde: existing?.kunde ?? "",
    extra: existing?.extra ?? "",
    ue: existing?.ue ?? "",
    reports: existing?.reports ?? "",
    meetings: existing?.meetings ?? "",
    tf: existing?.tf ?? "",
    ent: existing?.ent ?? "",
    inbox: existing?.inbox ?? "",
    chat: existing?.chat ?? ""
  };
  for (const row of SAG_TREE) {
    if (row.slot && map[row.slot]) continue;
    if (UD_NEST.includes(row.name) && existing?.udbud) continue;
    const parent = row.parent ? map[row.parent] : rootId;
    if (!parent) continue;
    const folder = await findOrCreateExact(parent, row.name);
    if (folder.id && row.slot) map[row.slot] = folder.id;
    loginRequired = loginRequired || folder.loginRequired;
    if (!folder.id && (row.slot === "udbud" || row.slot === "reports" || row.slot === "chat")) {
      return { ok: false, error: folder.error ?? `Mappe mangler: ${row.name}`, loginRequired, map, rootId };
    }
  }
  if (!map.ks) map.ks = map.reports;
  if (!map.chat) {
    const oldChat = await findExactChild(rootId, CHAT_FOLDER_NAME);
    if (oldChat.id) map.chat = oldChat.id;
  }
  if (!map.root) return { ok: false, error: "Ingen sag-mappe", loginRequired, map, rootId };
  rememberDrive(data.projectId, map);
  return {
    ok: true,
    map,
    rootId,
    loginRequired
  };
});
var chatFolderCache = /* @__PURE__ */ new Map();
export const ensureChatFolder = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const hit = chatFolderCache.get(data.projectId);
  if (hit && Date.now() - hit.at < 30 * 60_000 && hit.id) return {
    ok: true,
    folderId: hit.id
  };
  const known = driveFor(data.projectId)?.chat;
  if (known) {
    chatFolderCache.set(data.projectId, {
      at: Date.now(),
      id: known
    });
    return {
      ok: true,
      folderId: known
    };
  }
  const root = driveFor(data.projectId)?.root ?? "";
  if (!root) return {
    ok: false,
    error: "Ingen sag-mappe"
  };
  const foundBesked = await findExactChild(root, BESKEDER_FOLDER_NAME);
  const found = foundBesked.id ? foundBesked : await findOrCreateExact(root, BESKEDER_FOLDER_NAME);
  if (!found.id) {
    const old = await findExactChild(root, CHAT_FOLDER_NAME);
    if (old.id) {
      chatFolderCache.set(data.projectId, { at: Date.now(), id: old.id });
      return { ok: true, folderId: old.id };
    }
    return {
      ok: false,
      error: found.error ?? "Kunne ikke oprette 07 Beskeder",
      loginRequired: found.loginRequired
    };
  }
  chatFolderCache.set(data.projectId, {
    at: Date.now(),
    id: found.id
  });
  return {
    ok: true,
    folderId: found.id
  };
});
export const appendChatLog = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const folder = await ensureChatFolder({ data: { projectId: data.projectId } });
  if (!folder.ok) return {
    ok: false,
    error: folder.error,
    loginRequired: folder.loginRequired
  };
  const { callTool } = await import("@/lib/app-data/client.server");
  const wrote = await race(callTool("google_drive_create_file", {
    name: `${(new Date()).toISOString().slice(0, 16).replace("T", "_").replace(":", "")}-${(data.employeeName || "chat").replace(/[^\w.\-æøåÆØÅ ]+/g, "_").slice(0, 24)}-${data.title.replace(/[^\w.\-æøåÆØÅ ]+/g, "_").slice(0, 40) || "log"}.txt`,
    parent_id: folder.folderId,
    mimeType: "text/plain",
    content: data.text.slice(0, 16000)
  }, { connectorType: ConnectorType.GoogleDrive }), 10000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  return {
    ok: Boolean(wrote.ok),
    folderId: folder.folderId,
    fileId: wrote.ok ? idFrom(wrote.data) : "",
    loginRequired: wrote.loginRequired ?? folder.loginRequired
  };
});
export const listMeetingFiles = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const folderId = driveFor(data.projectId)?.meetings ?? "";
  if (!folderId) return {
    ok: true,
    files: [],
    loginRequired: false
  };
  const { callTool } = await import("@/lib/app-data/client.server");
  const listed = await race(callTool(GoogleDriveTools.listFolder, {
    folder_id: folderId,
    max_results: 40
  }, { connectorType: ConnectorType.GoogleDrive }), 6000, {
    ok: false,
    data: null,
    errorMessage: "timeout"
  });
  if (!listed.ok) return {
    ok: true,
    files: [],
    loginRequired: listed.loginRequired,
    loginUrl: listed.loginUrl,
    error: listed.errorMessage
  };
  return {
    ok: true,
    files: mergeFiles(filesFrom(listed.data)).filter((f) => /\.pdf$|\.docx?$|\.txt$/i.test(f.name) || /bm|møde|referat/i.test(f.name)).slice(0, 12).map((f) => ({
      id: f.id,
      name: f.name
    })),
    loginRequired: listed.loginRequired
  };
});
export const askMasterDesk = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  const query = data.query.trim();
  const empty = {
    ok: true,
    line: "",
    used: [],
    citations: [],
    loginRequired: false,
    loginUrl: undefined
  };
  if (!query) return empty;
  const listed = await listProjectUdbud(data.projectId);
  const map = driveFor(data.projectId);
  const extraFolders = [];
  if (map?.meetings) extraFolders.push(map.meetings);
  if (map?.reports) extraFolders.push(map.reports);
  if (map?.extra) extraFolders.push(map.extra);
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const extraListed = await Promise.all(extraFolders.slice(0, 3).map((folder_id) => race(callTool(GoogleDriveTools.listFolder, {
    folder_id,
    max_results: 40
  }, opts), 4000, {
    ok: false,
    data: null,
    errorMessage: "timeout",
    loginRequired: false
  })));
  const extraFiles = [];
  let loginRequired = listed.loginRequired;
  let loginUrl = listed.loginUrl;
  for (const row of extraListed) {
    if (row.loginRequired) {
      loginRequired = true;
      loginUrl = row.loginUrl ?? loginUrl;
    }
    if (row.ok) extraFiles.push(...filesFrom(row.data).filter((f) => !isFolder(f)));
  }
  let searchFiles = [];
  if (!loginRequired) {
    const searched = await race(callTool(GoogleDriveTools.search, {
      query: `${data.projectName} ${query}`.slice(0, 180),
      max_results: 8
    }, opts), 5000, {
      ok: false,
      data: null,
      errorMessage: "timeout",
      loginRequired: false
    });
    if (searched.loginRequired) {
      loginRequired = true;
      loginUrl = searched.loginUrl ?? loginUrl;
    }
    if (searched.ok) searchFiles = filesFrom(searched.data).filter((f) => !isFolder(f));
  }
  const words = expandQueryWords(docTokens(query));
  const ranked = [...mergeFiles([
    ...listed.files,
    ...extraFiles,
    ...searchFiles
  ])].sort((a, b) => scoreFile(b.name, words) - scoreFile(a.name, words));
  const chosen = (ranked.filter((f) => scoreFile(f.name, words) > 0).slice(0, 3).length ? ranked.filter((f) => scoreFile(f.name, words) > 0).slice(0, 3) : ranked.slice(0, 3)).slice(0, 3);
  const extracted = [];
  if (!loginRequired) for (const file of chosen) try {
    const text = await readDriveFile(file.id);
    if (text) extracted.push({
      name: file.name,
      text: text.slice(0, 7000)
    });
  } catch {}
  for (const row of UDBUD_CORPUS[data.projectId] ?? []) {
    if (extracted.some((e) => e.name === row.name)) continue;
    if (!words.length || words.some((w) => row.text.toLowerCase().includes(w) || row.name.toLowerCase().includes(w))) extracted.push({
      name: row.name,
      text: row.text.slice(0, 5000)
    });
    if (extracted.length >= 5) break;
  }
  const local = answerDocs(query, data.projectId);
  const packed = extracted.map((f) => `### ${f.name}\n${f.text.slice(0, 6000)}`).join("\n\n").slice(0, 14000);
  const grok = await grokChatWeb({
    system: `Du er mester-bot for Zenko Danmark på sagen ${data.projectName}.
Du må kigge i ALLE mapper på Google Drive (udbud, byggemøder, KS, ekstra arbejde, TF) og på internettet.
Du må tale om priser, aftalesedler, LIN, faktura og interne aftaler — det er mester.
Svar på dansk, konkret, citér filnavn når du bruger Drive. Hvis du søger på nettet, sig kilden kort.
Ingen markdown-overskrifter. Kort.`,
    user: `Spørgsmål: ${query.slice(0, 800)}\n\n${data.brief ? `Info-skærm:\n${data.brief.slice(0, 2500)}\n\n` : ""}Drive-uddrag:\n${packed || local?.line || "Ingen filer læst — brug udbudskorpus og nettet."}`,
    history: data.history,
    maxTokens: 700,
    timeoutMs: 28000
  });
  const line = grok?.text || local?.line || "Jeg fandt ikke et sikkert svar. Prøv at pege på en mappe eller et møde.";
  const used = extracted.map((f) => f.name);
  if (grok?.citations.length) used.push(...grok.citations.slice(0, 3).map((c) => c.replace(/^https?:\/\//, "").slice(0, 48)));
  return {
    ok: true,
    line,
    used,
    citations: grok?.citations ?? [],
    loginRequired,
    loginUrl
  };
});

const UD_NAMES = ["11 Pladsfiler", "12 Erfaring", "13 Dagsrapport"];

async function udFolderIds(projectId) {
  const root = driveFor(projectId)?.root ?? "";
  if (!root) return { ok: false, folders: [], loginRequired: false, error: "Ingen sag-mappe" };
  const folders = [];
  let loginRequired = false;
  let udbud = driveFor(projectId)?.udbud ?? "";
  if (!udbud) {
    const made = await findOrCreateExact(root, "01 Udbudsmateriale");
    udbud = made.id;
    loginRequired = loginRequired || Boolean(made.loginRequired);
  }
  for (const name of UD_NAMES) {
    const nested = udbud ? await findExactChild(udbud, name) : { id: "" };
    const atRoot = await findExactChild(root, name);
    let folder = nested.id ? nested : atRoot.id ? atRoot : { id: "", error: "" };
    if (!folder.id && udbud) {
      folder = await findOrCreateExact(udbud, name);
    }
    loginRequired = loginRequired || Boolean(folder.loginRequired);
    folders.push({ name, id: folder.id, error: folder.error });
  }
  return { ok: folders.some((f) => f.id), folders, loginRequired };
}

export const ensureUdFolders = createServerFn({ method: "POST" }).validator((input) => input).handler(async ({ data }) => {
  return udFolderIds(data.projectId);
});

export const listUdCounts = createServerFn({ method: "POST" }).validator((input) => input).handler(async ({ data }) => {
  const ens = await udFolderIds(data.projectId);
  if (!ens.ok) return { ok: false, total: 0, folders: ens.folders, loginRequired: ens.loginRequired, error: ens.error };
  const counts = [];
  let total = 0;
  for (const f of ens.folders) {
    if (!f.id) {
      counts.push({ name: f.name, id: "", count: 0 });
      continue;
    }
    const listed = await listDriveContents({ data: { folderId: f.id } });
    const n = (listed.items ?? []).filter((x) => !x.folder && !/\.note\.json$/i.test(x.name)).length;
    total += n;
    counts.push({ name: f.name, id: f.id, count: n });
  }
  return { ok: true, total, folders: counts, loginRequired: ens.loginRequired };
});

export const listUdFolder = createServerFn({ method: "POST" }).validator((input) => input).handler(async ({ data }) => {
  const ens = await udFolderIds(data.projectId);
  const folder = ens.folders.find((f) => f.name === data.folderName) ?? ens.folders[0];
  if (!folder?.id) return { ok: false, items: [], loginRequired: ens.loginRequired };
  const listed = await listDriveContents({ data: { folderId: folder.id } });
  const items = (listed.items ?? []).map((x) => ({
    id: x.id,
    name: x.name,
    folder: Boolean(x.folder),
    href: x.folder ? "" : "",
  }));
  return { ok: true, folderId: folder.id, items, loginRequired: listed.loginRequired };
});

export const uploadUdFile = createServerFn({ method: "POST" }).validator((input) => input).handler(async ({ data }) => {
  const root = driveFor(data.projectId)?.root ?? "";
  if (!root) return { ok: false, error: "Ingen sag-mappe" };
  const folderName = String(data.folderName || "11 Pladsfiler");
  const folder = await ensureDriveFolderPath(root, folderName);
  if (!folder.id) return { ok: false, error: folder.error ?? "Kunne ikke oprette mappe", loginRequired: folder.loginRequired };
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const name = String(data.name || `ud-${Date.now()}`);
  const wrote = await race(callTool("google_drive_create_file", {
    name,
    parent_id: folder.id,
    mimeType: data.mimeType || "application/octet-stream",
    content: data.contentBase64,
    content_base64: data.contentBase64,
  }, opts), 20000, { ok: false, data: null, errorMessage: "timeout" });
  const fileId = wrote.ok ? idFrom(wrote.data) : "";
  if (!fileId) return { ok: false, error: wrote.errorMessage ?? "Upload fejlede", loginRequired: wrote.loginRequired, folderId: folder.id };
  const note = {
    type: data.udType || "",
    date: data.date || new Date().toISOString().slice(0, 10),
    lines: String(data.note || "").split(/\n/).filter(Boolean).slice(0, 5),
    uncertain: Boolean(data.uncertain),
    draft: Boolean(data.draft),
    folder: folderName,
    fileId,
    fileName: name,
    from: data.employeeName || "",
  };
  const noteName = `${name.replace(/\.[^.]+$/, "")}${data.draft ? ".draft" : ""}.note.json`;
  await race(callTool("google_drive_create_file", {
    name: noteName,
    parent_id: folder.id,
    mimeType: "application/json",
    content: JSON.stringify(note, null, 2),
  }, opts), 10000, { ok: false, data: null });
  return {
    ok: true,
    fileId,
    folderId: folder.id,
    href: "",
    draft: Boolean(data.draft),
  };
});

export const saveUdDraft = createServerFn({ method: "POST" }).validator((input) => input).handler(async ({ data }) => {
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const read = await race(callTool(GoogleDriveTools.readFile, { file_id: data.noteId, max_chars: 8000 }, opts), 8000, { ok: false, data: null });
  if (!read.ok) return { ok: false, error: "Kunne ikke læse udkast" };
  let body = {};
  try {
    const raw = typeof read.data === "string" ? read.data : JSON.stringify(read.data);
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    body = JSON.parse(raw.slice(start, end + 1));
  } catch {
    body = {};
  }
  body.draft = false;
  const wrote = await race(callTool("google_drive_create_file", {
    name: data.noteName || "gemt.note.json",
    parent_id: data.folderId,
    mimeType: "application/json",
    content: JSON.stringify(body, null, 2),
  }, opts), 10000, { ok: false, data: null });
  return { ok: Boolean(wrote.ok), loginRequired: wrote.loginRequired };
});

export const askUdFolders = createServerFn({ method: "POST" }).validator((input) => input).handler(async ({ data }) => {
  const query = String(data.query || "").trim();
  const only = String(data.folderName || "");
  const ens = await udFolderIds(data.projectId);
  const notes = [];
  for (const f of ens.folders) {
    if (only && f.name !== only) continue;
    if (!f.id) continue;
    const listed = await listDriveContents({ data: { folderId: f.id } });
    for (const item of (listed.items ?? []).filter((x) => /\.note\.json$/i.test(x.name)).slice(0, 12)) {
      const text = await readDriveFile(item.id);
      notes.push({ folder: f.name, name: item.name, fileId: item.id, text: text.slice(0, 1200) });
    }
    for (const item of (listed.items ?? []).filter((x) => !x.folder && !/\.note\.json$/i.test(x.name)).slice(0, 8)) {
      notes.push({ folder: f.name, name: item.name, fileId: item.id, text: "" });
    }
  }
  if (!notes.length) return { ok: true, line: "Ingen filer i 11/12/13 på sagen.", used: [] };
  const packed = notes.map((n) => `### ${n.folder} / ${n.name}\n${n.text || "(fil — åbn i Drive, gæt ikke indhold)"}`).join("\n\n").slice(0, 12000);
  const grok = await grokChat({
    system: `Du læser 11 Pladsfiler (kontrakt/udførelse), 12 Erfaring (pladsviden) og 13 Dagsrapport (dagbog). Bland ALDRIG med 01 Udbudsmateriale. Gæt aldrig produkt (700 vs 750). Sig usikker hvis indekset er tyndt. Citér mappe og filnavn. Når nogen spørger, peg på filen (filnavn + file_id). Kort, intet markdown.`,
    user: `Spørgsmål: ${query.slice(0, 600)}\n\n${packed}`,
    maxTokens: 500,
    timeoutMs: 18000,
  });
  return { ok: true, line: grok || "Jeg fandt ikke et sikkert svar i 11/12/13. Åbn filen i Drive.", used: notes.slice(0, 6).map((n) => n.name) };
});

async function exactChildFolder(parentId, name) {
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const listed = await race(callTool(GoogleDriveTools.listFolder, { folder_id: parentId }, opts), 8000, {
    ok: false,
    data: null,
    errorMessage: "timeout",
  });
  if (listed.ok) {
    const found = filesFrom(listed.data).find((f) => f.name === name);
    if (found) return { id: found.id, loginRequired: listed.loginRequired };
  }
  const created = await race(callTool(GoogleDriveTools.createFolder, { name, parent_id: parentId }, opts), 8000, {
    ok: false,
    data: null,
    errorMessage: "timeout",
  });
  if (created.ok) {
    const id = idFrom(created.data);
    if (id) return { id, loginRequired: created.loginRequired };
  }
  return { id: "", loginRequired: listed.loginRequired || created.loginRequired, error: created.errorMessage ?? listed.errorMessage };
}

export const uploadProfilePhoto = createServerFn({ method: "POST" }).validator((input) => input).handler(async ({ data }) => {
  const person = String(data.name || "").trim() || "Ukendt";
  const admin = await exactChildFolder(SAGER_ROOT_ID, ADMIN_NAME);
  if (!admin.id) return { ok: false, fileId: "", error: admin.error || "00 Admin mangler", loginRequired: admin.loginRequired };
  const profilers = await exactChildFolder(admin.id, "Profiler");
  if (!profilers.id) return { ok: false, fileId: "", error: profilers.error || "Profiler-mappe mangler", loginRequired: profilers.loginRequired };
  const folder = await exactChildFolder(profilers.id, person);
  if (!folder.id) return { ok: false, fileId: "", error: folder.error || "Profilmappe mangler", loginRequired: folder.loginRequired };
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const wrote = await race(callTool("google_drive_create_file", {
    name: data.fileName || "profil.jpg",
    parent_id: folder.id,
    mimeType: data.mimeType || "image/jpeg",
    content: data.contentBase64,
    content_base64: data.contentBase64,
  }, opts), 20000, { ok: false, data: null, errorMessage: "timeout" });
  const fileId = wrote.ok ? idFrom(wrote.data) : "";
  return {
    ok: Boolean(fileId),
    fileId,
    folderId: folder.id,
    loginRequired: wrote.loginRequired,
    loginUrl: wrote.loginUrl,
    error: fileId ? undefined : wrote.errorMessage,
  };
});

export const writeSagJson = createServerFn({ method: "POST" }).validator((input) => input).handler(async ({ data }) => {
  const root = driveFor(data.projectId)?.root ?? "";
  if (!root) return { ok: false, fileId: "", error: "Ingen Drive-mappe" };
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const payload = data.payload && typeof data.payload === "object" ? data.payload : {};
  const wrote = await race(callTool("google_drive_create_file", {
    name: "00 Sag.json",
    parent_id: root,
    mimeType: "application/json",
    content: JSON.stringify(payload, null, 2).slice(0, 40000),
  }, opts), 12000, { ok: false, data: null, errorMessage: "timeout" });
  const fileId = wrote.ok ? idFrom(wrote.data) : "";
  return {
    ok: Boolean(fileId),
    fileId,
    loginRequired: wrote.loginRequired,
    error: fileId ? undefined : wrote.errorMessage,
  };
});

