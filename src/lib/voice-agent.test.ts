import assert from "node:assert/strict";
import test from "node:test";
import {
  MASTER_TOOLS,
  PROBLEM_FLOW,
  SVEND_TOOLS,
  allowedTools,
  appLangToVoice,
  classifySetsStatus,
  detectVoiceLang,
  findPerson,
  isConfirmUtterance,
  isRejectUtterance,
  needsConfirm,
  nextProblemStatus,
  openaiTools,
  parseProblemClass,
  parseProblemStatus,
  pendingDecision,
  resolveSag,
  svendMayReadFolder,
  toolForbidden,
  voiceLangToAppLang,
  stripVoiceMd,
  fallbackUtterance,
  attachPhotoLine,
  parseFileIds,
  splitDataUrl,
  resolveDriveFolder,
  photoFolderForReply,
  type VoicePending,
  type VoiceYardSnap,
} from "./voice-agent.ts";

function snap(over: Partial<VoiceYardSnap> = {}): VoiceYardSnap {
  return {
    employeeId: "emp-ole",
    employeeName: "Ole",
    role: "mester",
    projects: [
      { id: "job-hillerodsholm", name: "Hillerødsholm", address: "Hillerød", status: "active" },
      { id: "job-islev", name: "Islev", address: "Rødovre", status: "active" },
    ],
    employees: [
      { id: "emp-ole", name: "Ole", role: "mester", language: "da" },
      { id: "emp-alex", name: "Alex", role: "laerling", language: "da" },
      { id: "emp-marius", name: "Marius Pater", role: "svend", language: "pl" },
      { id: "emp-osvaldo", name: "Osvaldo", role: "svend", language: "es" },
    ],
    slips: [{ id: "slip-1", number: "Z-AS-2026-017", projectId: "job-hillerodsholm", title: "Stål i væg", customerPrice: "" }],
    tfs: [],
    ents: [],
    ks: [],
    todos: [],
    plans: [],
    problems: [
      {
        id: "vp-1",
        projectId: "job-hillerodsholm",
        fromId: "emp-alex",
        fromName: "Alex",
        text: "Stål i væggen",
        photoFileIds: [],
        status: "TIL_MESTER",
        createdAt: "2026-09-05T08:00:00.000Z",
      },
    ],
    ...over,
  };
}

test("mester har 18 værktøjer, ansat 10", () => {
  assert.equal(MASTER_TOOLS.length, 18);
  assert.equal(SVEND_TOOLS.length, 10);
  assert.equal(allowedTools("mester").length, 18);
  assert.equal(allowedTools("svend").length, 10);
  assert.equal(openaiTools("mester").length, 18);
  assert.equal(openaiTools("svend").length, 10);
});

test("ansat-sandkasse: forbudt at oprette AS/ER/KS, sætte beløb, læse fil, scanne sag", () => {
  for (const name of ["opret_as", "opret_er", "opret_ks", "saet_beloeb", "laes_fil", "scan_sag", "find_rapport", "todo_til_folk", "send_besked", "saet_status", "læg_fil", "scan_mail", "notat_til"]) {
    assert.equal(toolForbidden("svend", name), true, name);
  }
  for (const name of SVEND_TOOLS) {
    assert.equal(toolForbidden("svend", name), false, name);
  }
  assert.equal(svendMayReadFolder("01 Udbudsmateriale"), true);
  assert.equal(svendMayReadFolder("11 Pladsfiler"), true);
  assert.equal(svendMayReadFolder("12 Erfaring"), true);
  assert.equal(svendMayReadFolder("13 Dagsrapport"), true);
  assert.equal(svendMayReadFolder("02 KS"), false);
  assert.equal(svendMayReadFolder("05 Rapporter"), false);
  assert.equal(svendMayReadFolder("00 Admin"), false);
});

test("bekræftelse kræves før AS/ER/KS og beløb", () => {
  assert.equal(needsConfirm("opret_as"), true);
  assert.equal(needsConfirm("opret_er"), true);
  assert.equal(needsConfirm("opret_ks"), true);
  assert.equal(needsConfirm("saet_beloeb"), true);
  assert.equal(needsConfirm("todo_til_folk"), false);
  assert.equal(needsConfirm("send_besked"), false);
  assert.equal(isConfirmUtterance("ja"), true);
  assert.equal(isConfirmUtterance("Ja tak"), true);
  assert.equal(isConfirmUtterance("yes"), true);
  assert.equal(isConfirmUtterance("da"), true);
  assert.equal(isConfirmUtterance("sí"), true);
  assert.equal(isConfirmUtterance("nej"), false);
  assert.equal(isRejectUtterance("nej"), true);
  assert.equal(isRejectUtterance("no"), true);
  const pending: VoicePending = { name: "opret_as", args: { sag: "job-hillerodsholm", titel: "Stål" }, summary: "AS" };
  assert.equal(pendingDecision(pending, "ja"), "commit");
  assert.equal(pendingDecision(pending, "nej"), "cancel");
  assert.equal(pendingDecision(pending, "læg også to-do på Alex"), "continue");
  assert.equal(pendingDecision(null, "ja"), "continue");
});

test("sprog per besked: dansk tysk polsk rumænsk spansk engelsk", () => {
  assert.equal(detectVoiceLang("Hvad skal vi gøre med stålet?"), "da");
  assert.equal(detectVoiceLang("Was sollen wir mit dem Stahl machen?"), "de");
  assert.equal(detectVoiceLang("Co robimy ze stalą w ścianie?"), "pl");
  assert.equal(detectVoiceLang("Ce facem cu oțelul din perete?"), "ro");
  assert.equal(detectVoiceLang("¿Qué hacemos con el muro?"), "es");
  assert.equal(detectVoiceLang("What should we do with the steel in the wall?"), "en");
  assert.equal(voiceLangToAppLang("pl"), "pl");
  assert.equal(voiceLangToAppLang("de"), "da");
  assert.equal(voiceLangToAppLang("en"), "da");
  assert.equal(appLangToVoice("es"), "es");
  assert.equal(appLangToVoice("uk"), "da");
});

test("problem-flow NY → LUKKET", () => {
  let cur = PROBLEM_FLOW[0]!;
  assert.equal(cur, "NY");
  const seen: string[] = [cur];
  while (nextProblemStatus(cur)) {
    cur = nextProblemStatus(cur)!;
    seen.push(cur);
  }
  assert.deepEqual(seen, ["NY", "TIL_MESTER", "KLASSIFICERET", "I_ARBEJDE", "TIMER_IN", "PRISSAT", "TIL_KUNDE", "LUKKET"]);
  assert.equal(nextProblemStatus("LUKKET"), null);
  assert.equal(classifySetsStatus("AS"), "KLASSIFICERET");
  assert.equal(parseProblemStatus("til mester"), "TIL_MESTER");
  assert.equal(parseProblemClass("as"), "AS");
});

test("ansat bruger tjek-ind-sag, mester spørger hvis flere aktive", () => {
  const svend = snap({
    employeeId: "emp-alex",
    employeeName: "Alex",
    role: "svend",
    checkedInProjectId: "job-hillerodsholm",
  });
  assert.equal(resolveSag(svend)?.id, "job-hillerodsholm");
  assert.equal(resolveSag(svend, "Islev")?.id, "job-islev");
  const mester = snap();
  assert.equal(resolveSag(mester), null);
  assert.equal(resolveSag(mester, "hillerød")?.id, "job-hillerodsholm");
  assert.equal(findPerson(mester, "Marian")?.id, "emp-marius");
  assert.equal(findPerson(mester, "Osvaldo")?.id, "emp-osvaldo");
});

test("stemmesvar uden markdown", () => {
  assert.equal(stripVoiceMd("**Aktiv sag:** Hillerødsholm"), "Aktiv sag: Hillerødsholm");
});

test("tekst+billeder: samme hjerne, møde vs plads", () => {
  assert.equal(fallbackUtterance("disse 6 billeder skal Alex rydde i morgen", 6), "disse 6 billeder skal Alex rydde i morgen");
  assert.equal(fallbackUtterance("", 6), "Se de 6 vedhæftede billeder.");
  assert.equal(fallbackUtterance("", 1), "Se det vedhæftede billede.");
  assert.equal(fallbackUtterance("", 0), "");
  assert.match(attachPhotoLine(["abc123file", "def456file"]), /abc123file/);
  assert.equal(attachPhotoLine([]), "");
  assert.deepEqual(parseFileIds("abc123file, def456file"), ["abc123file", "def456file"]);
  assert.equal(photoFolderForReply("text"), "07 Beskeder");
  assert.equal(photoFolderForReply("voice"), "06 To-do");
  assert.equal(resolveDriveFolder("dette er udbud på Hillerødsholm"), "01 Udbudsmateriale");
  assert.equal(resolveDriveFolder("06 To-do"), "06 To-do");
  assert.equal(resolveDriveFolder("læg i 01"), "01 Udbudsmateriale");
  assert.equal(resolveDriveFolder("11 Pladsfiler"), "11 Pladsfiler");
  assert.equal(resolveDriveFolder("læg i 12 Erfaring"), "12 Erfaring");
  assert.equal(resolveDriveFolder("dagsrapport i dag"), "13 Dagsrapport");
  assert.equal(resolveDriveFolder("erfaring om blå plader — ikke udbud"), "12 Erfaring");
  const split = splitDataUrl("data:image/jpeg;base64,QUJD");
  assert.equal(split.mime, "image/jpeg");
  assert.equal(split.base64, "QUJD");
});
