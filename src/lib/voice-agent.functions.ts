// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import { ConnectorType, GoogleDriveTools } from "@/lib/app-data";
import { grokChat, grokChatWeb } from "./grok-chat";
import { driveFor } from "./drive";
import { askUdbud, listUdbudFiles, saveWeekPlan, ensureDriveFolderPath, askUdFolders, listUdFolder, resolveJobOrAdminRoot, resolveJobFolder } from "./drive.functions";
import { resolveUdFolder } from "./ud-folders";
import { listBoardMail } from "./mail.functions";
import { addDaysYmd, parseDaysList, planPlaceLabel, rangesFromDays, resolvePlanPlace, startOfIsoWeek } from "./plan";
import { copenhagenDate } from "./seed";
import {
  MASTER_SYSTEM,
  SVEND_SYSTEM,
  appLangToVoice,
  attachPhotoLine,
  detectVoiceLang,
  fallbackUtterance,
  findPerson,
  openaiTools,
  parseFileIds,
  parseProblemClass,
  parseProblemStatus,
  pendingDecision,
  photoFolderForReply,
  plainArgs,
  resolveDriveFolder,
  resolveSag,
  stripVoiceMd,
  toolForbidden,
  voiceLangToAppLang,
  type AppLang,
  type VoiceClientAction,
  type VoiceLang,
  type VoicePending,
  type VoiceProblem,
  type VoiceYardSnap,
} from "./voice-agent";

function apiKey() {
  return process.env.XAI_API_KEY?.trim() || "";
}
function race(p, ms, fallback) {
  let timer;
  return Promise.race([p.finally(() => {
    if (timer) clearTimeout(timer);
  }), new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  })]);
}
function idFrom(data) {
  if (!data || typeof data !== "object") return "";
  const row = data;
  return String(row.id || row.file_id || row.fileId || "");
}
export const voiceEphemeralToken = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async () => {
  const key = apiKey();
  if (!key) return {
    ok: false,
    error: "AI is not available"
  };
  const res = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      expires_after: { seconds: 300 },
      model: "grok-voice-latest"
    })
  });
  if (!res.ok) return {
    ok: false,
    error: `token ${res.status}`
  };
  const body = await res.json();
  if (!body.value) return {
    ok: false,
    error: "empty token"
  };
  return {
    ok: true,
    token: body.value,
    expiresAt: body.expires_at ?? Math.floor(Date.now() / 1e3) + 300,
    wsUrl: "wss://api.x.ai/v1/realtime?model=grok-voice-latest"
  };
});
async function stt(audioBase64, mime) {
  const key = apiKey();
  if (!key) return null;
  let buf;
  try {
    buf = Buffer.from(audioBase64, "base64");
  } catch {
    return null;
  }
  if (buf.length < 200 || buf.length > 24e5) return null;
  const ext = mime.includes("mp4") ? "m4a" : mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : "webm";
  const form = new FormData();
  form.append("format", "true");
  form.append("file", new Blob([new Uint8Array(buf)], { type: mime || "audio/webm" }), `clip.${ext}`);
  const res = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form
  });
  if (!res.ok) return null;
  return ((await res.json()).text ?? "").trim() || null;
}
async function tts(text, lang) {
  const key = apiKey();
  if (!key) return null;
  const clean = stripVoiceMd(text).slice(0, 700);
  const res = await fetch("https://api.x.ai/v1/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      text: clean,
      voice_id: "eve",
      language: lang
    })
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 80) return null;
  return `data:audio/mpeg;base64,${buf.toString("base64")}`;
}
async function translateLine(text, lang) {
  return (await grokChat({
    system: `Oversæt til ${{
      da: "dansk",
      de: "tysk",
      pl: "polsk",
      ro: "rumænsk",
      es: "spansk",
      en: "engelsk"
    }[lang]}. Skriv KUN den oversatte tekst. Gæt ikke indhold til.`,
    user: text,
    maxTokens: 400,
    timeoutMs: 8000
  }) ?? "").trim() || text;
}
async function grokTools(opts) {
  const key = apiKey();
  if (!key) return {
    text: "",
    calls: []
  };
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 700,
      temperature: .15,
      tools: opts.tools,
      messages: [{
        role: "system",
        content: opts.system
      }, ...opts.messages]
    })
  });
  if (!res.ok) return {
    text: "",
    calls: []
  };
  const msg = (await res.json()).choices?.[0]?.message;
  const calls = (msg?.tool_calls ?? []).map((c) => {
    let args = {};
    try {
      args = JSON.parse(c.function.arguments || "{}");
    } catch {
      args = {};
    }
    return {
      id: c.id,
      name: c.function.name,
      args
    };
  });
  return {
    text: (msg?.content ?? "").trim(),
    calls
  };
}
async function writeDriveNote(projectId: string, folderName: string, fileName: string, text: string) {
  const folder = await resolveJobFolder(projectId, "", folderName);
  const folderId = folder.id;
  if (!folderId) return { fileId: "", loginRequired: folder.loginRequired, error: folder.error };
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const wrote = await race(
    callTool(
      "google_drive_create_file",
      {
        name: fileName,
        parent_id: folderId,
        mimeType: "application/json",
        content: text.slice(0, 20000),
      },
      opts,
    ),
    10000,
    { ok: false as const, data: null },
  );
  return { fileId: wrote.ok ? idFrom(wrote.data) : "", folderId };
}

async function putDrivePhoto(data: { projectId: string; projectName?: string; name: string; mimeType: string; contentBase64: string; folderName: string }) {
  const folder = await resolveJobFolder(data.projectId, data.projectName, data.folderName);
  const folderId = folder.id;
  if (!folderId) return { ok: false as const, fileId: "", folderId: "", error: folder.error || "Ingen sag-mappe", loginRequired: folder.loginRequired };
  const { callTool } = await import("@/lib/app-data/client.server");
  const opts = { connectorType: ConnectorType.GoogleDrive };
  const wrote = await race(
    callTool(
      "google_drive_create_file",
      {
        name: data.name,
        parent_id: folderId,
        mimeType: data.mimeType || "image/jpeg",
        content: data.contentBase64,
        content_base64: data.contentBase64,
      },
      opts,
    ),
    20000,
    { ok: false as const, data: null },
  );
  const fileId = wrote.ok ? idFrom(wrote.data) : "";
  return { ok: Boolean(fileId), fileId, folderId, error: fileId ? undefined : "Drive svarede ikke. Prøv igen.", loginRequired: wrote.loginRequired || folder.loginRequired };
}

export const uploadVoicePhoto = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  return race(putDrivePhoto(data), 12000, { ok: false as const, fileId: "", folderId: "", error: "Drive svarede ikke. Prøv igen." });
});
function stamp() {
  return (new Date()).toISOString().slice(0, 16).replace("T", "_").replace(":", "");
}
async function runTool(name, args, snap, lang, photoFileIds = [], photos = []) {
  if (toolForbidden(snap.role, name)) return {
    text: "Det har du ikke adgang til.",
    actions: []
  };
  const sagArg = String(args.sag ?? args.projectId ?? "");
  const sag = resolveSag(snap, sagArg);
  if (name === "hvilken_sag") {
    if (!sag) return {
      text: "Hvilken sag? Sig navnet.",
      actions: []
    };
    return {
      text: `${sag.name}, ${sag.address}`,
      actions: []
    };
  }
  if (name === "scan_sag") {
    if (!sag) return {
      text: "Hvilken sag skal jeg scanne?",
      actions: []
    };
    const as = snap.slips.filter((s) => s.projectId === sag.id);
    const tf = snap.tfs.filter((s) => s.projectId === sag.id);
    const er = snap.ents.filter((s) => s.projectId === sag.id);
    const ks = snap.ks.filter((s) => s.projectId === sag.id);
    const td = snap.todos.filter((s) => s.projectId === sag.id && !s.done);
    const pr = snap.problems.filter((s) => s.projectId === sag.id && s.status !== "LUKKET");
    const files = await listUdbudFiles({ data: { projectId: sag.id } });
    const fileLine = files.ok ? files.files.slice(0, 6).map((f) => f.name).join(", ") : "udbud ikke læst";
    return {
      text: `${sag.name}: ${as.length} AS, ${tf.length} TF, ${er.length} ER, ${ks.length} KS, ${td.length} åbne to-do, ${pr.length} åbne problemer. Udbud: ${fileLine}.`,
      actions: []
    };
  }
  if (name === "laes_udbud") {
    const job = sag ?? resolveSag(snap);
    if (!job) return {
      text: snap.role === "svend" ? "Tjek ind på en sag først." : "Hvilken sag?",
      actions: []
    };
    if (snap.role === "svend" && snap.checkedInProjectId && job.id !== snap.checkedInProjectId) return {
      text: "Du må kun læse udbuddet på den sag du har valgt.",
      actions: []
    };
    const q = String(args.spoergsmaal ?? args.query ?? "");
    return {
      text: (await askUdbud({ data: {
        projectId: job.id,
        query: q
      } })).line || "Jeg fandt ikke det i udbuddet. Lad mig tjekke igen, hvis du siger det med andre ord.",
      actions: []
    };
  }
  if (name === "laes_ud") {
    const job = sag ?? resolveSag(snap);
    if (!job) return {
      text: snap.role === "svend" ? "Tjek ind på en sag først." : "Hvilken sag?",
      actions: []
    };
    if (snap.role === "svend" && snap.checkedInProjectId && job.id !== snap.checkedInProjectId) return {
      text: "Du må kun læse 11/12/13 på den sag du står på.",
      actions: []
    };
    const q = String(args.spoergsmaal ?? args.query ?? "");
    const folderName = resolveUdFolder(String(args.mappe ?? "")) ?? "";
    const res = await askUdFolders({ data: { projectId: job.id, query: q, folderName } });
    return {
      text: res.line || "Jeg fandt ikke det i 11/12/13. Åbn filen i Drive.",
      actions: []
    };
  }
  if (name === "udkast_ud") {
    const job = sag ?? resolveSag(snap);
    if (!job) return {
      text: snap.role === "svend" ? "Tjek ind på en sag først." : "Hvilken sag?",
      actions: []
    };
    if (snap.role === "svend" && snap.checkedInProjectId && job.id !== snap.checkedInProjectId) return {
      text: "Du må kun skrive på den sag du står på.",
      actions: []
    };
    const tekst = String(args.tekst ?? "").trim();
    if (!tekst) return { text: "Hvad skal der stå?", actions: [] };
    const mappe = String(args.mappe ?? "");
    const udType = String(args.type ?? args.slags ?? "");
    let folder = resolveUdFolder(mappe) || resolveUdFolder(udType) || "12 Erfaring";
    if (folder.startsWith("01")) folder = "12 Erfaring";
    if (folder.startsWith("11")) {
      folder = /dags|vejr|klarg|levering|stop/i.test(`${mappe} ${udType} ${tekst}`) ? "13 Dagsrapport" : "12 Erfaring";
    }
    const tag = folder.startsWith("13") ? "dags" : "erfaring";
    const stem = `${stamp()}-${tag}`;
    await writeDriveNote(job.id, folder, `${stem}.txt`, tekst);
    await writeDriveNote(job.id, folder, `${stem}.draft.note.json`, JSON.stringify({
      type: udType,
      date: new Date().toISOString().slice(0, 10),
      lines: tekst.split(/\n/).filter(Boolean).slice(0, 5),
      uncertain: true,
      draft: true,
      folder,
      fileName: `${stem}.txt`,
      from: snap.employeeName,
    }, null, 2));
    return { text: `Udkast lagt i ${folder}. Mester skal trykke Gem.`, actions: [] };
  }
  if (name === "notat_til") {
    if (snap.role !== "mester") return { text: "Kun mester kan lave mødenotat.", actions: [] };
    const job = sag ?? resolveSag(snap);
    if (!job) return { text: "Hvilken sag?", actions: [] };
    const til = String(args.til ?? "").trim();
    if (!til) return { text: "Til hvem? Elektrikeren eller trælasten?", actions: [] };
    const listed = await listUdFolder({ data: { projectId: job.id, folderName: "13 Dagsrapport" } });
    const files = (listed.items ?? []).filter((x) => !x.folder).slice(0, 16);
    const packed = files.map((f) => `${f.name} (${f.id})`).join("\n");
    const grok = await grokChat({
      system: `Skriv et kort mødenotat til ${til} på sagen ${job.name}. Tre kugler. Neutral tone — mester retter. Brug 13 Dagsrapport (dato + foto-id). Bland ikke med 01 Udbud eller 12 Erfaring. Ingen markdown-overskrifter.`,
      user: `Modtager: ${til}\nFiler i 13 Dagsrapport:\n${packed || "(ingen filer)"}`,
      maxTokens: 400,
      timeoutMs: 12000,
    });
    const body = String(grok || `Notat til ${til}. Tre punkter mangler — ingen dagsrapport læst.`).trim();
    const stem = `${stamp()}-notat-${til.replace(/[^\wæøåÆØÅ]+/g, "-").slice(0, 24)}`;
    await writeDriveNote(job.id, "13 Dagsrapport", `${stem}.txt`, body);
    await writeDriveNote(job.id, "13 Dagsrapport", `${stem}.draft.note.json`, JSON.stringify({
      type: "Mødenotat",
      date: new Date().toISOString().slice(0, 10),
      lines: body.split(/\n/).filter(Boolean).slice(0, 5),
      draft: true,
      folder: "13 Dagsrapport",
      fileName: `${stem}.txt`,
      from: snap.employeeName,
      til,
    }, null, 2));
    return { text: `Udkast til ${til} lagt i 13 Dagsrapport. Ret tonen og tryk Gem.`, actions: [] };
  }
  if (name === "min_plan") {
    const today = copenhagenDate();
    const start = startOfIsoWeek(today);
    const end = addDaysYmd(start, 6);
    const mine = (snap.plans ?? []).filter(
      (p) => p.employeeId === snap.employeeId && p.start <= end && p.end >= start,
    );
    if (!mine.length) {
      return { text: "Ingen plan for dig i denne uge.", actions: [] };
    }
    const lines = mine
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((p) => {
        const sag = snap.projects.find((j) => j.id === p.projectId)?.name || p.place || p.projectId;
        return `${p.start}–${p.end}: ${sag} — ${p.title}`;
      });
    return { text: `Din uge (${start}–${end}): ${lines.join(" · ")}`, actions: [] };
  }
  if (name === "mine_todo") {
    const open = (snap.todos ?? []).filter((x) => x.assigneeId === snap.employeeId && !x.done);
    if (!open.length) return { text: "Du har ingen åbne to-do.", actions: [] };
    return {
      text: open
        .slice(0, 8)
        .map((x) => {
          const sag = snap.projects.find((j) => j.id === x.projectId)?.name || "";
          return `${x.title}${sag ? ` (${sag})` : ""}`;
        })
        .join(" · "),
      actions: [],
    };
  }
  if (name === "laes_fil") {
    const id = String(args.fil_id ?? "");
    if (!id) return {
      text: "Mangler fil-id.",
      actions: []
    };
    const { callTool } = await import("@/lib/app-data/client.server");
    const read = await race(callTool(GoogleDriveTools.readFile, { file_id: id }, { connectorType: ConnectorType.GoogleDrive }), 12000, {
      ok: false,
      data: null
    });
    const raw = read.ok && read.data ? JSON.stringify(read.data).slice(0, 4000) : "";
    return {
      text: raw ? raw.slice(0, 900) : "Kunne ikke læse filen.",
      actions: []
    };
  }
  if (name === "soeg_net") {
    const q = String(args.query ?? "");
    return {
      text: (await grokChatWeb({
        system: "Kort svar om materialer, montage eller sikkerhed for murerarbejde. Gæt ikke priser. Svar på brugerens sprog. Sig hellere at du ikke ved det.",
        user: q,
        maxTokens: 400
      }))?.text || "Jeg fandt ikke noget sikkert. Lad mig tjekke.",
      actions: []
    };
  }
  if (name === "find_rapport") {
    const q = String(args.query ?? "").toLowerCase();
    return {
      text: [
        ...snap.slips.map((s) => `${s.number} AS ${s.title}`),
        ...snap.tfs.map((s) => `${s.number} TF ${s.title}`),
        ...snap.ents.map((s) => `${s.number} ER ${s.title}`),
        ...snap.ks.map((s) => `KS ${s.number} ${s.point}`)
      ].filter((line) => line.toLowerCase().includes(q)).slice(0, 8).join(" · ") || "Ingen rapport ramte søgningen.",
      actions: []
    };
  }
  if (name === "opret_as" || name === "opret_er" || name === "opret_ks") {
    if (!sag) return {
      text: "Hvilken sag?",
      actions: []
    };
    const summary = name === "opret_ks" ? `KS ${String(args.punkt ?? "")} på ${sag.name}` : `${name === "opret_as" ? "AS" : "ER"} “${String(args.titel ?? "")}” på ${sag.name}`;
    return {
      text: `Skal jeg oprette ${summary}? Sig ja.`,
      actions: [],
      pending: {
        name,
        args: {
          ...plainArgs(args),
          sag: sag.id
        },
        summary
      }
    };
  }
  if (name === "saet_beloeb") {
    const id = String(args.as_id ?? "");
    const beloeb = String(args.beloeb ?? "");
    return {
      text: `Skal jeg sætte ${beloeb} på ${id}? Sig ja.`,
      actions: [],
      pending: {
        name,
        args: plainArgs(args),
        summary: `${id} · ${beloeb}`
      }
    };
  }
  if (name === "todo_til_folk") {
    const person = findPerson(snap, String(args.person ?? ""));
    if (!person) return {
      text: "Hvem skal have to-doen?",
      actions: []
    };
    const job = sag ?? snap.projects[0];
    if (!job) return {
      text: "Hvilken sag?",
      actions: []
    };
    const title = String(args.tekst ?? "").slice(0, 80);
    const due = String(args.dato ?? copenhagenDate());
    const ids = [.../* @__PURE__ */ new Set([...photoFileIds, ...parseFileIds(String(args.billede_ids ?? ""))])];
    const wrote = await writeDriveNote(job.id, "06 To-do", `${stamp()}-${person.name.split(" ")[0]}-${title.slice(0, 24)}.json`, JSON.stringify({
      person: person.name,
      title,
      due,
      from: snap.employeeName,
      photoFileIds: ids
    }, null, 2));
    const destLang = appLangToVoice(person.language);
    let spoken = `To-do til ${person.name}: ${title}.`;
    if (destLang !== "da") {
      const translated = await translateLine(title, destLang);
      spoken = `To-do til ${person.name}: ${translated}.`;
    }
    return {
      text: spoken,
      actions: [{
        type: "add_todo",
        projectId: job.id,
        assigneeId: person.id,
        title,
        body: title,
        due,
        needsPhoto: args.foto !== false,
        driveFileId: wrote.fileId || undefined,
        photoFileIds: ids
      }]
    };
  }
  if (name === "todo_til_mig") {
    const job = sag ?? resolveSag(snap);
    if (!job) return {
      text: "Tjek ind på en sag først.",
      actions: []
    };
    const title = String(args.tekst ?? "").slice(0, 80);
    const due = String(args.dato ?? copenhagenDate());
    const ids = [.../* @__PURE__ */ new Set([...photoFileIds, ...parseFileIds(String(args.billede_ids ?? ""))])];
    const wrote = await writeDriveNote(job.id, "06 To-do", `${stamp()}-mig-${title.slice(0, 24)}.json`, JSON.stringify({
      title,
      due,
      who: snap.employeeName,
      photoFileIds: ids
    }, null, 2));
    return {
      text: `To-do til dig: ${title}.`,
      actions: [{
        type: "add_todo",
        projectId: job.id,
        assigneeId: snap.employeeId,
        title,
        body: title,
        due,
        needsPhoto: false,
        driveFileId: wrote.fileId || undefined,
        photoFileIds: ids
      }]
    };
  }
  if (name === "send_besked") {
    const person = findPerson(snap, String(args.til ?? ""));
    if (!person) return {
      text: "Hvem skal have beskeden?",
      actions: []
    };
    const job = sag ?? snap.projects[0];
    if (!job) return {
      text: "Hvilken sag?",
      actions: []
    };
    const text = String(args.tekst ?? "");
    const destLang = appLangToVoice(person.language);
    let delivered = text;
    if (destLang !== lang) delivered = await translateLine(text, destLang);
    const translations = {
      [voiceLangToAppLang(lang)]: text,
      [voiceLangToAppLang(destLang)]: delivered
    };
    await writeDriveNote(job.id, "07 Beskeder", `${stamp()}-til-${person.name.split(" ")[0]}.json`, JSON.stringify({
      til: person.name,
      text,
      delivered,
      from: snap.employeeName,
      lang: destLang,
      photoFileIds
    }, null, 2));
    return {
      text: `Sendt til ${person.name}.`,
      actions: [{
        type: "add_chat",
        fromId: snap.employeeId,
        toEmployeeId: person.id,
        projectId: job.id,
        text,
        lang,
        translations
      }]
    };
  }
  if (name === "send_til_mester" || name === "opret_problem") {
    const job = sag ?? resolveSag(snap);
    if (!job) return {
      text: "Tjek ind på en sag først.",
      actions: []
    };
    const text = String(args.tekst ?? "");
    const daText = lang === "da" ? text : await translateLine(text, "da");
    const problem = {
      id: `vp-${Date.now().toString(36)}`,
      projectId: job.id,
      fromId: snap.employeeId,
      fromName: snap.employeeName,
      text,
      photoFileIds: [.../* @__PURE__ */ new Set([...photoFileIds, ...parseFileIds(String(args.billede_ids ?? ""))])],
      status: "TIL_MESTER",
      createdAt: (new Date()).toISOString()
    };
    problem.driveFileId = (await writeDriveNote(job.id, "07 Beskeder", `${stamp()}-problem.json`, JSON.stringify(problem, null, 2))).fileId;
    const translations = { da: daText };
    const appLang = voiceLangToAppLang(lang);
    if (appLang !== "da") translations[appLang] = text;
    return {
      text: "Sendt til mester.",
      actions: [{
        type: "add_problem",
        problem
      }, {
        type: "add_chat",
        fromId: snap.employeeId,
        toMasters: true,
        projectId: job.id,
        text,
        lang,
        translations
      }]
    };
  }
  if (name === "saet_status") {
    const id = String(args.problem_id ?? "");
    const status = parseProblemStatus(String(args.status ?? ""));
    if (!status) return {
      text: "Ukendt status.",
      actions: []
    };
    const klass = parseProblemClass(String(args.klassificering ?? ""));
    const problem = snap.problems.find((p) => p.id === id);
    const patch = { status };
    if (klass) {
      patch.klassificering = klass;
      patch.status = "KLASSIFICERET";
    }
    const actions = [{
      type: "patch_problem",
      id,
      patch
    }];
    if ((status === "TIL_KUNDE" || patch.status === "TIL_KUNDE") && (problem?.asId || args.as_id)) actions.push({
      type: "forward_as",
      numberOrId: String(problem?.asId ?? args.as_id)
    });
    return {
      text: `Status ${klass ? `KLASSIFICERET · ${klass}` : status}.`,
      actions
    };
  }
  if (name === "læg_fil") {
    if (!sag) return {
      text: "Hvilken sag skal filerne ligge på?",
      actions: []
    };
    const folder = resolveDriveFolder(String(args.mappe ?? ""), "05 Rapporter");
    const ids = [...photoFileIds];
    for (const p of photos) {
      const up = await putDrivePhoto({
        projectId: sag.id,
        name: p.name || `fil-${stamp()}.jpg`,
        mimeType: p.mimeType || "image/jpeg",
        contentBase64: p.contentBase64,
        folderName: folder
      });
      if (up.fileId) ids.push(up.fileId);
    }
    const note = String(args.note ?? "");
    await writeDriveNote(sag.id, "08 Voice-log", `${stamp()}-læg-fil.json`, JSON.stringify({
      who: snap.employeeName,
      sag: sag.name,
      folder,
      note,
      fileIds: ids
    }, null, 2));
    return {
      text: ids.length ? `Lagt i ${sag.name} / ${folder}. ${ids.length} fil(er).` : `Mappen ${folder} er klar på ${sag.name}. Send filen igen.`,
      actions: []
    };
  }
  if (name === "scan_mail") {
    const mail = await listBoardMail({ data: { days: Number(args.dage ?? 3) || 3 } });
    return {
      text: (mail.items ?? []).slice(0, 6).map((m) => `${m.date} ${m.from}: ${m.subject}`).join(" · ") || mail.headline || "Ingen sag-mail de sidste dage.",
      actions: []
    };
  }
  if (name === "læg_plan") {
    const person = findPerson(snap, String(args.person ?? ""));
    if (!person) return {
      text: "Hvem skal i planen?",
      actions: []
    };
    const uge = String(args.uge ?? "");
    const dageText = `${/næste/.test(uge) ? "næste uge " : ""}${String(args.dage ?? "")}`;
    const days = parseDaysList(dageText);
    if (!days.length) return {
      text: "Hvilke dage? Sig mandag, tirsdag…",
      actions: []
    };
    const sted = resolvePlanPlace(String(args.sted ?? ""), snap.projects);
    const title = String(args.udfores ?? "").trim() || "Udførsel";
    const actions = rangesFromDays(days).map((r) => ({
      type: "add_plan",
      employeeId: person.id,
      projectId: sted.projectId,
      place: sted.place,
      title,
      start: r.start,
      end: r.end
    }));
    const line = `${person.name} · ${days.join(", ")} · ${sted.place ?? sted.projectId} · ${title}`;
    try {
      await saveWeekPlan({ data: {
        week: String(days[0]?.slice(0, 4) ?? ""),
        weekStart: days[0] ?? copenhagenDate(),
        weekEnd: days[days.length - 1] ?? days[0] ?? "",
        text: line
      } });
    } catch {}
    return {
      text: `Lagt i ugeplan: ${person.name}, ${planPlaceLabel({
        projectId: sted.projectId,
        place: sted.place,
        title
      })}, ${title}.`,
      actions
    };
  }
  return {
    text: "Ukendt værktøj.",
    actions: []
  };
}
async function commitPending(pending, snap) {
  const name = pending.name;
  const args = pending.args;
  const sag = resolveSag(snap, String(args.sag ?? ""));
  if (name === "opret_as") {
    if (!sag) return {
      text: "Mangler sag.",
      actions: []
    };
    const title = String(args.titel ?? "Ekstra arbejde");
    const body = String(args.tekst ?? title);
    await writeDriveNote(sag.id, "02 Ekstra arbejde", `${stamp()}-AS-${title.slice(0, 20)}.json`, JSON.stringify({
      title,
      body
    }, null, 2));
    return {
      text: `AS oprettet som udkast: ${title}.`,
      actions: [{
        type: "add_as",
        projectId: sag.id,
        title,
        body,
        location: String(args.sted ?? sag.name)
      }]
    };
  }
  if (name === "opret_er") {
    if (!sag) return {
      text: "Mangler sag.",
      actions: []
    };
    const title = String(args.titel ?? "Entreprenørrapport");
    return {
      text: `ER oprettet: ${title}.`,
      actions: [{
        type: "add_er",
        projectId: sag.id,
        title,
        body: String(args.tekst ?? title),
        location: String(args.sted ?? sag.name)
      }]
    };
  }
  if (name === "opret_ks") {
    if (!sag) return {
      text: "Mangler sag.",
      actions: []
    };
    return {
      text: `KS ${String(args.punkt ?? "")} oprettet.`,
      actions: [{
        type: "add_ks",
        projectId: sag.id,
        point: String(args.punkt ?? "div"),
        location: String(args.sted ?? ""),
        deviations: String(args.afvigelse ?? "Ingen")
      }]
    };
  }
  if (name === "saet_beloeb") return {
    text: `Beløb ${String(args.beloeb)} sat på ${String(args.as_id)}.`,
    actions: [{
      type: "patch_as",
      numberOrId: String(args.as_id),
      customerPrice: String(args.beloeb)
    }]
  };
  return {
    text: "Ikke bekræftet.",
    actions: []
  };
}
export const voiceTurn = createServerFn({ method: "POST" }).validator((input: any) => input).handler(async ({ data }) => {
  if (!apiKey()) return {
    ok: false,
    error: "AI is not available"
  };
  const photos = (data.photos ?? []).filter((p) => p.contentBase64).slice(0, 8);
  let uttered = fallbackUtterance(data.text ?? "", photos.length);
  if (!uttered && data.audioBase64) {
    uttered = await stt(data.audioBase64, data.mime || "audio/webm") ?? "";
    uttered = fallbackUtterance(uttered, photos.length);
  }
  if (!uttered) return {
    ok: false,
    error: "empty"
  };
  const lang = data.lang || detectVoiceLang(uttered);
  const snap = data.snap;
  const reply = data.reply === "text" ? "text" : "voice";
  const jobId = snap.checkedInProjectId || snap.projects[0]?.id || "job-hillerodsholm";
  const folderName = data.folderName || (snap.role === "svend" ? "08 Voice-log" : resolveDriveFolder(uttered, photoFolderForReply(reply)));
  const photoFileIds = [];
  for (const p of photos) {
    const up = await putDrivePhoto({
      projectId: jobId,
      name: p.name || `foto-${stamp()}.jpg`,
      mimeType: p.mimeType || "image/jpeg",
      contentBase64: p.contentBase64,
      folderName
    });
    if (up.fileId) photoFileIds.push(up.fileId);
  }
  const userContent = `${uttered}${attachPhotoLine(photoFileIds)}`;
  await writeDriveNote(jobId, "08 Voice-log", `${stamp()}-${snap.role}-${snap.employeeName.split(" ")[0]}.json`, JSON.stringify({
    who: snap.employeeName,
    role: snap.role,
    uttered,
    lang,
    reply,
    photoFileIds
  }, null, 2));
  async function maybeTts(text) {
    if (reply === "text") return null;
    return tts(text, appLangToVoice(lang));
  }
  const decision = pendingDecision(data.pending, uttered);
  if (decision === "commit" && data.pending) {
    const done = await commitPending(data.pending, snap);
    const doneText = stripVoiceMd(done.text);
    return {
      ok: true,
      text: doneText,
      audio: await maybeTts(doneText),
      lang,
      actions: (done.actions ?? []) as VoiceClientAction[],
      pending: null,
      transcript: uttered,
      photoFileIds
    };
  }
  if (decision === "cancel") {
    const text = lang === "da" ? "Ok, jeg opretter ikke." : "Ok.";
    return {
      ok: true,
      text,
      audio: await maybeTts(text),
      lang,
      actions: [] as VoiceClientAction[],
      pending: null,
      transcript: uttered,
      photoFileIds
    };
  }
  const langNames = {
    da: "dansk",
    de: "tysk",
    pl: "polsk",
    ro: "rumænsk",
    es: "spansk",
    en: "engelsk",
    uk: "ukrainsk"
  };
  const system = `${snap.role === "mester" ? MASTER_SYSTEM : SVEND_SYSTEM}\nSvar kun på ${langNames[lang] || "dansk"}.`;
  const tools = openaiTools(snap.role);
  const messages = [...(data.history ?? []).slice(-6).map((h) => ({
    role: h.role,
    content: h.content
  })), {
    role: "user",
    content: userContent
  }];
  const actions: VoiceClientAction[] = [];
  let pending = data.pending ?? null;
  let spoken = "";
  for (let i = 0; i < 3; i++) {
    const turn = await grokTools({
      system,
      messages,
      tools
    });
    if (!turn.calls.length) {
      spoken = turn.text;
      break;
    }
    messages.push({
      role: "assistant",
      content: turn.text,
      tool_calls: turn.calls.map((c) => ({
        id: c.id,
        type: "function",
        function: {
          name: c.name,
          arguments: JSON.stringify(c.args)
        }
      }))
    });
    for (const call of turn.calls) {
      const r = await runTool(call.name, call.args, snap, lang, photoFileIds, photos);
      if (r.pending) {
        pending = r.pending;
        spoken = r.text;
      } else spoken = spoken || r.text;
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: r.text
      });
      actions.push(...r.actions);
    }
    if (pending && pending !== (data.pending ?? null)) break;
  }
  if (!spoken) spoken = "Jeg ved det ikke, lad mig tjekke.";
  spoken = stripVoiceMd(spoken);
  const audio = await maybeTts(spoken);
  return {
    ok: true,
    text: spoken,
    audio,
    lang,
    actions: actions as VoiceClientAction[],
    pending,
    transcript: uttered,
    photoFileIds
  };
});
