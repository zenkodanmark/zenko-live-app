import type {
  Assignment,
  CalEvent,
  ChatMessage,
  ControlPoint,
  DayLog,
  DocFolder,
  DocHit,
  Employee,
  Entrepreneur,
  GpsFix,
  InvoicePack,
  Issue,
  KsPhoto,
  KsReport,
  MaterialNeed,
  MemoryNote,
  PlanBlock,
  Project,
  SiteDoc,
  Slip,
  Tf,
  Todo,
  YardLog,
  FieldItem,
} from "./types";
import { OSVALDO_DATALON } from "./datalon-osvaldo.ts";
import { snippetFromCorpus } from "./udbud-corpus.ts";
import { controlPointsFromUdbud } from "./udbud-plan.ts";
import { MASTER_IDS } from "./crew.ts";

export { EMPLOYEES, isCrewRole, isMasterRole, MASTER_IDS } from "./crew.ts";


export const FIRM = "Zenko Danmark ApS";
export const FIRM_LINE = "Aabenraavej 161 · 6400 Sønderborg";
export const COMPANY_LINE = "Murerarbejde · Sønderborg";
export const FIRM_MAIL = "zenko.danmark@gmail.com";
export const FIRM_CVR = "42285757";
export const FIRM_PHONE = "23 23 23 83";

export const PROJECTS: Project[] = [
  {
    id: "job-hillerodsholm",
    name: "Hillerødsholm",
    address: "Selskovvej 24–26, 3400 Hillerød",
    lat: 55.9298,
    lng: 12.3105,
    radiusM: 180,
    brief: "NAB afd. 4121. Eksisterende 360 mm mur, hulmur 1.–2. sal. Indblæst stenuld, bindere, omfugning. Dalux + Drive.",
    huddle: "I dag: altan-rep 5.4, filsning vange 5.5, udkasning skorsten 5.7. 64 KS-fotos i Drive — ret Grok hvis forkert.",
    nextTask: "KS 5.4 / 5.5 / 5.7 — åbn foto, ret punkt hvis Grok tager fejl.",
    udbudFolderId: "1sY1Zxbb0KN9tWZITKun_JQ3Kom9LDSc_",
    status: "active",
    createdBy: "emp-ole",
    source: "Dalux + Google Drev",
    customer: "Ole Jepsen A/S",
    ksType: "alm",
  },
  {
    id: "job-islevvaenge",
    name: "Islevvænge",
    address: "Fortvej 50, 2610 Rødovre",
    lat: 55.7034,
    lng: 12.4535,
    radiusM: 200,
    brief: "Arne Jacobsen-rækkehuse, Rødovre afd. 2304. Gule og røde huse Fortvej/Knudsbølvej. Udbud: ISV_K01_C08.2_Zmur og Ztag i 01 Udbud.",
    huddle: "Uge 37 man: puds gavle røde Fortvej. Fuger 20 mm, KC 50/50/700, skrabefuge, ingen afsyring.",
    nextTask: "Puds gavle røde huse, Fortvej — se Zmur 213.202.",
    udbudFolderId: "1jrKrS6Q0T7Sa1cfbr-wYDejr-r2KGsBx",
    status: "active",
    createdBy: "emp-ole",
    source: "Byggeweb",
    customer: "Ole Jepsen A/S",
    ksType: "alm",
  },
  {
    id: "job-kaerhuset",
    name: "Kærhuset",
    address: "Kær Bygade 8, 6400 Sønderborg",
    lat: 54.9475,
    lng: 9.851,
    radiusM: 160,
    brief: "Mur og sokkel ved Kær. Ruskær 35 er samme sag. Afdækning ved nedbør. Drive.",
    huddle: "Sokkelmembran 5.1 og afdækning 6.1. Stillads mod gadekæret.",
    nextTask: "KS 5.1 — sokkelmembran, 200 mm over terræn.",
    udbudFolderId: "1b4TUbmrrOr7xc8EuYHhZrsYYNUUVJPm4",
    status: "active",
    createdBy: "emp-ole",
    source: "Drive",
    customer: "Ole Jepsen A/S",
    ksType: "alm",
  },
  {
    id: "job-solbakkegaard",
    name: "Solbakkegård",
    address: "Vester Snogbæk 15, 6400 Sønderborg",
    lat: 54.912,
    lng: 9.792,
    radiusM: 160,
    brief: "Gårdanlæg — tegl, overliggere og afdækning.",
    huddle: "Overligger 4.1 i stuehuset. Afdæk murkrone inden aften.",
    nextTask: "KS 4.1 — ståloverligger HEA 160, stuehus øst.",
    udbudFolderId: "12PaFXLv0PE-Tk4Mp20eGhwNQseQuo8Sx",
    status: "archived",
    createdBy: "emp-ole",
    source: "Dalux",
    customer: "Ole Jepsen A/S",
    handedOverAt: "2025-09-01",
    archivedAt: "2025-09-01T12:00:00.000Z",
  },
  {
    id: "job-skole",
    name: "Skole",
    address: "Skole (sted mangler i Dataløn)",
    lat: 55.93,
    lng: 12.31,
    radiusM: 120,
    brief: "Tre dage i marts: fuge out. Sagsnummer stod tomt i Dataløn.",
    huddle: "Fuge out.",
    nextTask: "Fuge out.",
    udbudFolderId: "10ZI4-PFoenKHU0ezBbCrAauAkgCHxilI",
    status: "archived",
    createdBy: "emp-ole",
    source: "Dataløn-kommentar",
    customer: "Ole Jepsen A/S",
    handedOverAt: "2021-09-15",
    archivedAt: "2021-09-15T12:00:00.000Z",
  },
  {
    id: "job-soren-privat",
    name: "Søren privat",
    address: "Privat sag — adresse mangler",
    lat: 55.676,
    lng: 12.568,
    radiusM: 120,
    brief: "Lille privat sag. Adresse mangler. Samme mappetræ som Hillerødsholm.",
    huddle: "Uge 37 tirsdag: Marius.",
    nextTask: "Udførsel tirsdag.",
    udbudFolderId: "1rSzZ5M_Gma3PUgE0Hf2Nr8LtSxBdFkl_",
    status: "active",
    createdBy: "emp-ole",
    source: "Oprettet af mester-bot",
    customer: "Privat",
  },
  {
    id: "job-klostergaarden",
    name: "Klostergården Hillerød",
    address: "Klostervej 1–15, 3400 Hillerød",
    lat: 55.9324,
    lng: 12.2978,
    radiusM: 160,
    brief: "Lejerbo Klostergården. Samme mappetræ som Hillerødsholm: 01–07 + 00 Admin.",
    huddle: "Uge 37: Federico og Osvaldo.",
    nextTask: "Udførsel uge 37.",
    udbudFolderId: "1jzE96Pk4T3POs2i7_LtU-LXMclKx5NMX",
    status: "active",
    createdBy: "emp-ole",
    source: "Oprettet af mester-bot",
    customer: "Ole Jepsen A/S",
  },
  {
    id: "job-provestenen",
    name: "Prøvestenen Frederiksværk",
    address: "Strandvejen 84, 3300 Frederiksværk",
    lat: 55.9706,
    lng: 11.9985,
    radiusM: 160,
    brief: "Strandvejen 84. Fuge out blok C/D, sten og vindueslysninger. Puds kælder uge 37.",
    huddle: "Uge 37 tirsdag–onsdag: Ole og Alex, puds kælder.",
    nextTask: "Puds kælder tirsdag og onsdag.",
    udbudFolderId: "14L-6haGCy5Yg6mB_00dsfX5KvRj52k66",
    status: "active",
    createdBy: "emp-ole",
    source: "Dataløn 2501 + mester-bot",
    customer: "Ole Jepsen A/S",
  },
];

export const ASSIGNMENTS: Assignment[] = [
  { employeeId: "emp-ole", projectId: "job-hillerodsholm" },
  { employeeId: "emp-ole", projectId: "job-islevvaenge" },
  { employeeId: "emp-ole", projectId: "job-kaerhuset" },
  { employeeId: "emp-ole", projectId: "job-solbakkegaard" },
  { employeeId: "emp-federico", projectId: "job-hillerodsholm" },
  { employeeId: "emp-federico", projectId: "job-islevvaenge" },
  { employeeId: "emp-federico", projectId: "job-kaerhuset" },
  { employeeId: "emp-federico", projectId: "job-solbakkegaard" },
  { employeeId: "emp-alex", projectId: "job-hillerodsholm" },
  { employeeId: "emp-ion", projectId: "job-hillerodsholm" },
  { employeeId: "emp-ion", projectId: "job-islevvaenge" },
  { employeeId: "emp-marius", projectId: "job-hillerodsholm" },
  { employeeId: "emp-marius", projectId: "job-kaerhuset" },
  { employeeId: "emp-osvaldo", projectId: "job-hillerodsholm" },
  { employeeId: "emp-osvaldo", projectId: "job-islevvaenge" },
  { employeeId: "emp-osvaldo", projectId: "job-kaerhuset" },
  { employeeId: "emp-osvaldo", projectId: "job-provestenen" },
  { employeeId: "emp-ole", projectId: "job-soren-privat" },
  { employeeId: "emp-ole", projectId: "job-klostergaarden" },
  { employeeId: "emp-ole", projectId: "job-provestenen" },
  { employeeId: "emp-federico", projectId: "job-soren-privat" },
  { employeeId: "emp-federico", projectId: "job-klostergaarden" },
  { employeeId: "emp-federico", projectId: "job-provestenen" },
  { employeeId: "emp-marius", projectId: "job-islevvaenge" },
  { employeeId: "emp-marius", projectId: "job-soren-privat" },
  { employeeId: "emp-alex", projectId: "job-islevvaenge" },
  { employeeId: "emp-alex", projectId: "job-provestenen" },
  { employeeId: "emp-osvaldo", projectId: "job-klostergaarden" },
];

export const PROJECT_ALIASES: Record<string, string> = {
  "job-strandvejen": "job-provestenen",
  "job-ruskaer": "job-kaerhuset",
};

export function canonicalProjectId(id: string) {
  return PROJECT_ALIASES[id] ?? id;
}

export function projectById(id: string) {
  const cid = canonicalProjectId(id);
  return PROJECTS.find((p) => p.id === cid) ?? PROJECTS[0]!;
}

export function seedFix(projectId: string, at: string, jitter = 0): GpsFix {
  const p = projectById(projectId);
  return {
    lat: p.lat + jitter * 0.00002,
    lng: p.lng + jitter * 0.00003,
    accuracyM: 8 + Math.abs(jitter),
    altitudeM: null,
    heading: null,
    speedMps: null,
    at,
    source: "device",
  };
}

export function seedPhoto(opts: {
  id: string;
  projectId: string;
  employeeId: string;
  employeeName: string;
  takenAt: string;
  floor: string;
  room: string;
  point: string;
  jitter?: number;
}): KsPhoto {
  const p = projectById(opts.projectId);
  const j = opts.jitter ?? 0;
  return {
    id: opts.id,
    dataUrl: "",
    takenAt: opts.takenAt,
    floor: opts.floor,
    room: opts.room,
    point: opts.point,
    gpsLabel: p.name,
    lat: p.lat + j * 0.00002,
    lng: p.lng + j * 0.00003,
    accuracyM: 8 + Math.abs(j),
    gpsSource: "device",
    projectId: p.id,
    projectName: p.name,
    employeeId: opts.employeeId,
    employeeName: opts.employeeName,
    originalName: `KS-${opts.point.replace(".", "")}-${opts.id}.jpg`,
    mimeType: "image/jpeg",
    deviceLabel: "felt",
    recognized: opts.point === "div" ? "div" : "plan",
  };
}

export const CONTROL_PLAN: ControlPoint[] = [
  { code: "1.1", title: "Sokkel / fundament", hint: "Sokkelhøjde, anlæg, fugt.", qcScope: "Alle sokler.", method: "Visuel + mål.", criteria: "Anlæg rent." },
  { code: "2.1", title: "Murværk, forbandt", hint: "Forbandt og bindere.", qcScope: "Facader og gavle.", method: "Visuel, foto.", criteria: "Forbandt overholdt." },
  { code: "2.2", title: "Fugning", hint: "Fuge 12 mm.", qcScope: "Udvendige fuger.", method: "Mål fuge, foto.", criteria: "12 mm. Fyldt i fuld dybde." },
  { code: "3.1", title: "Isolering", hint: "Isolering iht. udbud.", qcScope: "Facade.", method: "Mål tykkelse, foto.", criteria: "Ingen sprækker." },
  { code: "4.1", title: "Overliggere", hint: "Leje min. 150 mm.", qcScope: "Åbninger.", method: "Mål anlæg.", criteria: "Leje min. 150 mm." },
  { code: "4.2", title: "Armering i liggefuge", hint: "Murarmering.", qcScope: "Over og under åbninger.", method: "Foto før mørtel.", criteria: "Armering i fuld længde." },
  { code: "5.1", title: "Fugtsikring", hint: "Sokkelmembran 200 mm.", qcScope: "Sokkel.", method: "Mål over terræn.", criteria: "200 mm over terræn." },
  { code: "6.1", title: "Afdækning", hint: "Ved nedbør og nat.", qcScope: "Åbne murkroner.", method: "Foto ved dagens slut.", criteria: "Kroner tætte inden aften." },
];

function ksPoint(
  code: string,
  title: string,
  hint: string,
  qcScope: string,
  method: string,
  criteria: string,
  extra: { controlType: string; extent: string; process: string },
): ControlPoint {
  return { code, title, hint, qcScope, method, criteria, ...extra };
}

export const HILLEROD_KS: ControlPoint[] = [
  ksPoint("5.2", "Demontering og rensning af eksisterende murværk", "Visuel. Sten renset, klar til ommuring.", "Demontering af murværk og rensning af sten. Udbud K01_C08_002_Murer.", "Visuel. Løbende under udførelse.", "Sten renset. Ingen mørtelrester.", { controlType: "Visuel", extent: "50 %", process: "Murerarbejde" }),
  ksPoint("5.3", "Hulmursisolering", "Indblæst stenuld λD=37. Foto 50 %.", "Hulmur 1. og 2. sal samt gavle. Indblæses udefra. Udbud K01_C08_002_Murer.", "Visuel. Løbende under udførelse.", "Stenuld λD=37, autoriseret indblæsning. Ingen mørtel i hulrum.", { controlType: "Visuel", extent: "50 %", process: "Murerarbejde" }),
  ksPoint("5.4", "Reparationer af eksisterende murværk", "Altan-rep og huller i mur. Foto 50 %.", "Reparationer af eksisterende murværk, altaner. Udbud K01_C08_002_Murer.", "Visuel. Løbende under udførelse.", "Over 5 °C. Fuger fyldt. Ingen mørtel i hulrum.", { controlType: "Visuel", extent: "50 %", process: "Murerarbejde" }),
  ksPoint("5.5", "Filtsning af altaner og murede vanger", "Filsning/puds på altanvange. Foto 25 %.", "Filtsning af altaner og murede vanger. Udbud K01_C08_002_Murer.", "Visuel. Løbende under udførelse.", "Over 5 °C. Net i grundpuds. Fejlfrit udført.", { controlType: "Visuel", extent: "25 %", process: "Murerarbejde" }),
  ksPoint("5.6", "Bindere", "Ø4 rustfri. Min. 4/m².", "Renoveringsbindere i hulmur. Hjørner 6/m². Udbud K01_C08_002_Murer.", "Visuel og måling. Løbende under udførelse.", "Min. 4 stk/m², 6 stk/m² ved hjørner. Ø4 rustfri.", { controlType: "Visuel og måling", extent: "10 %", process: "Murerarbejde" }),
  ksPoint("5.7", "Omfugning af skorstene og gesimser", "Udkasning af fuger på skorsten. Foto 50 %.", "Omfugning af skorstene og gesimser. Udbud K01_C08_002_Murer.", "Visuel. Løbende under udførelse.", "Udfræs min. 20 mm. Trykket fuge. KKh 35/65/500.", { controlType: "Visuel", extent: "50 %", process: "Murerarbejde" }),
  ksPoint("5.8", "Mørtel", "Mørtel iht. udbud. Foto.", "Mørtel til ommuring og omfugning. Udbud K01_C08_002_Murer.", "Visuel. Løbende under udførelse.", "KKh 35/65/500. Over 5 °C.", { controlType: "Visuel", extent: "50 %", process: "Murerarbejde" }),
  ksPoint("6.1", "Afdækning af uafsluttet arbejde", "Afdæk åbne kroner inden aften.", "Afdækning af uafsluttet arbejde. Udbud K01_C08_002_Murer.", "Visuel. Ved dagens slut.", "Kroner tætte inden aften.", { controlType: "Visuel", extent: "100 %", process: "Murerarbejde" }),
  ksPoint("6.2", "Oprydning", "Pladsen ryddet.", "Oprydning. Udbud K01_C08_002_Murer.", "Visuel. Inden aflevering.", "Rent. Fejlfrit.", { controlType: "Visuel", extent: "100 %", process: "Murerarbejde" }),
  ksPoint("6.3", "Affaldshåndtering", "Affald sorteret.", "Affaldshåndtering. Udbud K01_C08_002_Murer.", "Visuel. Løbende.", "Sorteret. Bortskaffet.", { controlType: "Visuel", extent: "100 %", process: "Murerarbejde" }),
  ksPoint("6.4", "Opmåling", "Mål iht. udbud.", "Opmåling. Udbud K01_C08_002_Murer.", "Visuel og måling. Inden aflevering.", "Mål stemmer med udbud.", { controlType: "Visuel og måling", extent: "100 %", process: "Murerarbejde" }),
];

export function controlPlanFor(projectId?: string): ControlPoint[] {
  if (projectId === "job-hillerodsholm") return HILLEROD_KS;
  if (!projectId) return CONTROL_PLAN;
  const fromUdbud = controlPointsFromUdbud(projectId);
  if (fromUdbud.length) return fromUdbud;
  return [];
}

export function findControlPoint(code: string, projectId?: string): ControlPoint | undefined {
  if (code === "div") return DIV_POINT;
  return controlPlanFor(projectId).find((p) => p.code === code) ?? CONTROL_PLAN.find((p) => p.code === code) ?? HILLEROD_KS.find((p) => p.code === code);
}

export const DIV_POINT: ControlPoint = {
  code: "div",
  title: "Div. KS",
  hint: "Ukendt eller ekstra arbejde. Mester klassificerer.",
  qcScope: "Billeder der ikke matcher kontrolplanen.",
  method: "Mester vurderer.",
  criteria: "Mester sætter rigtigt KS-punkt.",
  controlType: "Mester",
  extent: "—",
  process: "Div.",
};

export const DOCS: DocHit[] = [
  { id: "doc-iso", title: "Hulmursisolering 5.3 / 3.6", page: "ukp 5.3", excerpt: "Hulmursisolering: stenuld λD=37, indblæst udefra af autoriseret firma. Ingen mørtel i hulrum. KS 5.3 foto 50 %. Ikke 190 mm Flexibatts.", keywords: ["isol", "hulmur", "stenuld", "indblæs", "lambda", "37", "mineraluld", "uld", "insulation"] },
  { id: "doc-fuge", title: "Omfugning 5.7", page: "ukp 5.7", excerpt: "Omfugning: udfræs min. 20 mm. Trykket fuge. Mørtel KKh 35/65/500. Over 5 °C. Ingen afsyring. KS 5.7 foto 50 %.", keywords: ["fuge", "fugning", "omfug", "kkh", "20 mm", "mørtel", "mortel", "trykket"] },
  { id: "doc-mur", title: "Eksisterende murværk", page: "arb.beskr.", excerpt: "Eksisterende 360 mm rød maskinsten, krydsforbandt, strandmørtel, trykket fuge. Fuldmur stuen. Hulmur 1. og 2. sal samt gavle. Ikke ny tegl i facaden.", keywords: ["mur", "facade", "forbandt", "tegl", "teglsten", "360", "maskinsten", "kryds", "hulmur", "rød"] },
  { id: "doc-binder", title: "Bindere 5.6", page: "ukp 5.6", excerpt: "Renoveringsbindere Ø4 rustfri. Min. 4 stk/m², 6 stk/m² ved hjørner. 75 mm i bagmur, fald udad. KS 5.6 foto 10 %.", keywords: ["binder", "bindere", "iboring", "rustfri", "ø4", "4/m", "75"] },
  { id: "doc-puds", title: "Facade- og sokkelpuds 5.5", page: "ukp 5.5", excerpt: "Facade- og sokkelpuds. Over 5 °C. Foto 25 %. Net i grundpuds.", keywords: ["puds", "sokkel", "altan", "temperatur"] },
  { id: "doc-tag", title: "Tag og inddækning 5.8 / 5.9", page: "ukp 5.8", excerpt: "Tagbelægning røde vingetegl TEGL 36, foto 50 %. Inddækninger foto 100 %.", keywords: ["tag", "tegl", "vinge", "inddæk", "skorsten"] },
  { id: "doc-stillads", title: "Udbud stillads Hillerødsholm", page: "s. 4", excerpt: "Stillads leveres af HAKI Danmark. Opstilling uge 36. Zenko rører ikke stillads uden HAKI.", keywords: ["stillads", "haki", "stillas", "scaffold"] },
];

export const FOLDERS: { id: DocFolder; label: string }[] = [
  { id: "meetings", label: "Byggemøder" },
  { id: "invoice", label: "Faktura" },
  { id: "comms", label: "Kommunikation" },
  { id: "drawings", label: "Tegninger" },
  { id: "udbud", label: "Udbud" },
];

export const SEED_DOCS: SiteDoc[] = [
  { id: "doc-udbud-1", projectId: "job-hillerodsholm", folder: "udbud", title: "K01_C08_002_Murer — udbudskontrolplan", from: "01 Udbudsmateriale", receivedAt: "2026-07-15T08:00:00.000Z", page: "ukp 5.2–6.4", excerpt: "Hulmursisolering stenuld λD=37. Bindere Ø4. Omfugning KKh 35/65/500.", body: "Udbud Hillerødsholm, K01_C08_002_Murer.\n\n5.3 Hulmursisolering: stenuld λD=37, indblæst.\n5.6 Bindere Ø4 rustfri, min. 4/m².\n5.7 Omfugning: udfræs 20 mm, trykket fuge, KKh 35/65/500." },
  {
    id: "doc-islev-mur",
    projectId: "job-islevvaenge",
    folder: "udbud",
    title: "ISV_K01_C08.2_Zmur — Murer",
    from: "01 Udbudsmateriale",
    receivedAt: "2026-09-04T10:00:00.000Z",
    page: "213.104 / 213.202",
    excerpt: "Fuger 20 mm, KC 50/50/700, skrabefuge. Puds/filts gavle røde Fortvej. Ingen afsyring.",
    body: "Islevvænge murerbeskrivelse. Gule: omfug facader og gavle, 3 % sten. Røde: omfug facader + vandskuring/filts på gavle Fortvej. Mørtel KC 50/50/700. Udkrads 20 mm.",
  },
  {
    id: "doc-islev-tag",
    projectId: "job-islevvaenge",
    folder: "udbud",
    title: "ISV_K01_C08.2_Ztag — Tagarbejder",
    from: "01 Udbudsmateriale",
    receivedAt: "2026-09-04T10:00:00.000Z",
    page: "213.103 / 213.101",
    excerpt: "Ekstra 2 skifter ved tag. Skorsten 85 % omfug / 15 % ny. Skifer gule, tegl røde.",
    body: "Islevvænge tagbeskrivelse. Murerarbejder ved tag og skorsten. Gule skifer, røde tegl. Skorsten: renselem tilmures, betonkrone af, top tyndpuds til stålkrone.",
  },
];

export const SEED_ISSUES: Issue[] = [];

export const SEED_SLIPS: Slip[] = [
  { id: "slip-skorsten-top", number: "Z-AS-2026-005", projectId: "job-hillerodsholm", title: "Udkradsning af fuger — skorsten top", location: "Hillerødsholm, skorsten tag", body: "Udkradsning af fuger på skorstenstoppen. Arbejde ud over udbud.\nUdføres nu mens stillads og tagoverdækning er oppe.", masterSolution: "Ekstra arbejde. Pris efter regning. Aftaleseddel til HE.", customerPrice: "0 kr", hoursEst: 0, materialsEst: "—", photoIds: ["fld-as-skorsten-01", "fld-as-skorsten-02"], createdAt: "2026-09-03T10:45:00.000Z", status: "issued", forwarded: false, paid: false },
];

export const SEED_FIELD_ITEMS: FieldItem[] = [
  {
    id: "fld-as-skorsten-01",
    projectId: "job-hillerodsholm",
    projectName: "Hillerødsholm",
    employeeId: "emp-ole",
    employeeName: "Grok",
    kind: "photo",
    name: "AS-Grok-skorsten-udkradsning-01.jpg",
    mimeType: "image/jpeg",
    dataUrl: "/as-grok/AS-Grok-skorsten-udkradsning-01.jpg",
    note: "Udkradsning af fuger, skorsten top.",
    takenAt: "2026-09-03T10:44:00.000Z",
    status: "classified",
    classifiedAs: "extra",
    classifiedAt: "2026-09-03T10:45:00.000Z",
    classifiedBy: "emp-ole",
    reportId: "slip-skorsten-top",
    driveFileId: "1TVJNa4rq75CL-eA6MO5cl68LlY3mRB-p",
    driveUrl: "",
    driveFolderId: "1APZRLYMNm3E2b7Wy5nwq5xgnEdIiBE7S",
    gpsLabel: "Hillerødsholm, skorsten tag",
  },
  {
    id: "fld-as-skorsten-02",
    projectId: "job-hillerodsholm",
    projectName: "Hillerødsholm",
    employeeId: "emp-ole",
    employeeName: "Grok",
    kind: "photo",
    name: "AS-Grok-skorsten-udkradsning-02.jpg",
    mimeType: "image/jpeg",
    dataUrl: "/as-grok/AS-Grok-skorsten-udkradsning-02.jpg",
    note: "Udkradsning af fuger, skorsten top.",
    takenAt: "2026-09-03T10:44:20.000Z",
    status: "classified",
    classifiedAs: "extra",
    classifiedAt: "2026-09-03T10:45:00.000Z",
    classifiedBy: "emp-ole",
    reportId: "slip-skorsten-top",
    driveFileId: "1TckwODDuPinE3VQrhFx0CTwzfgOKGNKe",
    driveUrl: "",
    driveFolderId: "1APZRLYMNm3E2b7Wy5nwq5xgnEdIiBE7S",
    gpsLabel: "Hillerødsholm, skorsten tag",
  },
  {
    id: "fld-tf-have-01",
    projectId: "job-hillerodsholm",
    projectName: "Hillerødsholm",
    employeeId: "emp-ole",
    employeeName: "Grok",
    kind: "photo",
    name: "TF-Grok-facade-haveside-01.jpg",
    mimeType: "image/jpeg",
    dataUrl: "/tf-grok/TF-Grok-facade-haveside-01.jpg",
    note: "Revner og løs puds, haveside. Vand ind i facaden.",
    takenAt: "2026-09-03T10:34:00.000Z",
    status: "classified",
    classifiedAs: "tf",
    classifiedAt: "2026-09-03T10:35:00.000Z",
    classifiedBy: "emp-ole",
    reportId: "tf-facade-have",
    driveFileId: "15hw_GRGKPBxQv-5airagsBEPoN7Wm6hw",
    driveUrl: "",
    driveFolderId: "1XtjLKxMcdvg5GqmZl31I63vbK1ew6crR",
    gpsLabel: "Hillerødsholm, haveside",
  },
  {
    id: "fld-tf-have-02",
    projectId: "job-hillerodsholm",
    projectName: "Hillerødsholm",
    employeeId: "emp-ole",
    employeeName: "Grok",
    kind: "photo",
    name: "TF-Grok-facade-haveside-02.jpg",
    mimeType: "image/jpeg",
    dataUrl: "/tf-grok/TF-Grok-facade-haveside-02.jpg",
    note: "Revner under vindue, haveside.",
    takenAt: "2026-09-03T10:34:10.000Z",
    status: "classified",
    classifiedAs: "tf",
    classifiedAt: "2026-09-03T10:35:00.000Z",
    classifiedBy: "emp-ole",
    reportId: "tf-facade-have",
    driveFileId: "1-8voZK59JbVWehKVkfip5EVi-rfMP8Rl",
    driveUrl: "",
    driveFolderId: "1XtjLKxMcdvg5GqmZl31I63vbK1ew6crR",
    gpsLabel: "Hillerødsholm, haveside",
  },
  {
    id: "fld-tf-have-03",
    projectId: "job-hillerodsholm",
    projectName: "Hillerødsholm",
    employeeId: "emp-ole",
    employeeName: "Grok",
    kind: "photo",
    name: "TF-Grok-facade-haveside-03.jpg",
    mimeType: "image/jpeg",
    dataUrl: "/tf-grok/TF-Grok-facade-haveside-03.jpg",
    note: "Pudset facade hjørne, haveside.",
    takenAt: "2026-09-03T10:34:20.000Z",
    status: "classified",
    classifiedAs: "tf",
    classifiedAt: "2026-09-03T10:35:00.000Z",
    classifiedBy: "emp-ole",
    reportId: "tf-facade-have",
    driveFileId: "1ox0oApWJcnu2SNPhvXzgrnFXetx5bybt",
    driveUrl: "",
    driveFolderId: "1XtjLKxMcdvg5GqmZl31I63vbK1ew6crR",
    gpsLabel: "Hillerødsholm, haveside",
  },
  {
    id: "fld-tf-have-04",
    projectId: "job-hillerodsholm",
    projectName: "Hillerødsholm",
    employeeId: "emp-ole",
    employeeName: "Grok",
    kind: "photo",
    name: "TF-Grok-facade-haveside-04.jpg",
    mimeType: "image/jpeg",
    dataUrl: "/tf-grok/TF-Grok-facade-haveside-04.jpg",
    note: "Revner ved vinduesfals, haveside.",
    takenAt: "2026-09-03T10:34:30.000Z",
    status: "classified",
    classifiedAs: "tf",
    classifiedAt: "2026-09-03T10:35:00.000Z",
    classifiedBy: "emp-ole",
    reportId: "tf-facade-have",
    driveFileId: "1fF6H9vzN6LqTO7f0cGZCm7mUXTc8ewka",
    driveUrl: "",
    driveFolderId: "1XtjLKxMcdvg5GqmZl31I63vbK1ew6crR",
    gpsLabel: "Hillerødsholm, haveside",
  },
  {
    id: "fld-tf-have-05",
    projectId: "job-hillerodsholm",
    projectName: "Hillerødsholm",
    employeeId: "emp-ole",
    employeeName: "Grok",
    kind: "photo",
    name: "TF-Grok-facade-haveside-05.jpg",
    mimeType: "image/jpeg",
    dataUrl: "/tf-grok/TF-Grok-facade-haveside-05.jpg",
    note: "Hårfine revner over vindue.",
    takenAt: "2026-09-03T10:34:40.000Z",
    status: "classified",
    classifiedAs: "tf",
    classifiedAt: "2026-09-03T10:35:00.000Z",
    classifiedBy: "emp-ole",
    reportId: "tf-facade-have",
    driveFileId: "1wFib9_3ADRLUDfR7f1rD9-VuiRpyU8wk",
    driveUrl: "",
    driveFolderId: "1XtjLKxMcdvg5GqmZl31I63vbK1ew6crR",
    gpsLabel: "Hillerødsholm, haveside",
  },
  {
    id: "fld-tf-have-06",
    projectId: "job-hillerodsholm",
    projectName: "Hillerødsholm",
    employeeId: "emp-ole",
    employeeName: "Grok",
    kind: "photo",
    name: "TF-Grok-facade-haveside-06.jpg",
    mimeType: "image/jpeg",
    dataUrl: "/tf-grok/TF-Grok-facade-haveside-06.jpg",
    note: "Lodret revne ved hjørne.",
    takenAt: "2026-09-03T10:34:50.000Z",
    status: "classified",
    classifiedAs: "tf",
    classifiedAt: "2026-09-03T10:35:00.000Z",
    classifiedBy: "emp-ole",
    reportId: "tf-facade-have",
    driveFileId: "1xl8ESWPo0oNErSQqzCMNukp-Kz23NNBu",
    driveUrl: "",
    driveFolderId: "1XtjLKxMcdvg5GqmZl31I63vbK1ew6crR",
    gpsLabel: "Hillerødsholm, haveside",
  },
  {
    id: "fld-tf-have-07",
    projectId: "job-hillerodsholm",
    projectName: "Hillerødsholm",
    employeeId: "emp-ole",
    employeeName: "Grok",
    kind: "photo",
    name: "TF-Grok-facade-haveside-07.jpg",
    mimeType: "image/jpeg",
    dataUrl: "/tf-grok/TF-Grok-facade-haveside-07.jpg",
    note: "Revner i puds, haveside.",
    takenAt: "2026-09-03T10:35:00.000Z",
    status: "classified",
    classifiedAs: "tf",
    classifiedAt: "2026-09-03T10:35:00.000Z",
    classifiedBy: "emp-ole",
    reportId: "tf-facade-have",
    driveFileId: "1GF0NCSU6TivledofTl81GPaIBEzlymX7",
    driveUrl: "",
    driveFolderId: "1XtjLKxMcdvg5GqmZl31I63vbK1ew6crR",
    gpsLabel: "Hillerødsholm, haveside",
  },
  {
    id: "fld-tf-altan-01",
    projectId: "job-hillerodsholm",
    projectName: "Hillerødsholm",
    employeeId: "emp-ole",
    employeeName: "Ole",
    kind: "photo",
    name: "TF-Grok-altan-baeringer.png",
    mimeType: "image/png",
    dataUrl: "/tf-grok/TF-Grok-altan-baeringer.png",
    note: "Skitse fra projektafklaringsmøde 3. sep 2026. Udsparinger til altanbæringer under dør.",
    takenAt: "2026-09-03T15:40:00.000Z",
    status: "classified",
    classifiedAs: "tf",
    classifiedAt: "2026-09-04T05:20:00.000Z",
    classifiedBy: "emp-ole",
    reportId: "tf-altan-baeringer",
    gpsLabel: "Hillerødsholm, altan under dør",
  },
];

export const SEED_TFS: Tf[] = [
  {
    id: "tf-altan-baeringer",
    number: "Z-TF-2026-006",
    projectId: "job-hillerodsholm",
    title: "Altanbæringer — udsparing i mur under dør",
    question: `Til byggeledelsen, Ole Jepsen A/S
Til konstruktionsingeniør, altanleverandør / Altan og arkitekt

Sag: Hillerødsholm, Selskovvej 24–26, 3400 Hillerød (NAB afd. 4121)

Baggrund
Der blev afholdt projektafklaringsmøde på Hillerødsholm den 3. september 2026. Til stede var byggeledelsen fra Ole Jepsen A/S, ingeniøren fra Altan, altanleverandøren, projektets konstruktionsingeniør og arkitekten.

Emnet var de bærende udsparinger i den eksisterende mur, hvor altanernes bæringer skal ind i væggen — herunder under dør, hvor der er meget lidt plads at arbejde med.

Zenko er murerentreprenør. Vi hugger og murer efter det, de projekterende beslutter. Vi tager ikke konstruktivt ansvar for hullets geometri. Derfor dokumenterer vi her, hvad der blev gennemgået på mødet, så en af de projekterende ingeniører kan tage beslutningen og ansvaret.

Skitse fra mødet
Vedlagt skitse er tegnet på pladsen ud fra den samtale, ingeniørerne og beslutningstagerne havde. Alle mål i mm:

• Udsparing til venstre (under dør): højde 340 mm, anlæg 40 mm
• Udsparing til højre: 40 mm foroven, 200 mm i den markerede zone, skråt anlæg 120 mm, vandret 300 mm
• Fri afstand mellem bæringer (blåt mål): 356 mm
• Gul streg: vandret reference gennem begge udsparinger

De orange felter viser de zoner, vi forstår som udhugning i den eksisterende mur, så altanbæringerne kan sættes.

Hvorfor det haster
Stilladset står. Facade, fuger og altanarbejde kører. Hvis hullets geometri skal ændres senere, koster det både tid, stilladsdage og risiko for at ramme dør og overliggende konstruktion. Vi vil gerne have et skriftligt ja — eller en rettelse — før vi hugger.

Vi anmoder om
1. Skriftlig godkendelse af den viste geometri som udførelsesgrundlag for udsparinger til altanbæringer under dør.
2. Eller en rettet skitse / mål, hvis konstruktionen skal være anderledes.
3. Bekræftelse af, hvem der har det konstruktive ansvar for udsparingen (konstruktionsingeniør / Altan).

Vi hugger ikke, før I har svaret i denne forespørgsel.

Venlig hilsen
Ole
Zenko Danmark ApS`,
    createdAt: "2026-09-04T05:20:00.000Z",
    status: "issued",
    answered: false,
    photoIds: ["fld-tf-altan-01"],
    ledelseStatus: "med_til_ledelse",
  },
  {
    id: "tf-facade-have",
    number: "Z-TF-2026-005",
    projectId: "job-hillerodsholm",
    title: "Pudset facade haveside — revner og løs puds",
    question:
      "Den eksisterende pudsede facade på havesiden er i meget dårlig stand. Der er revner, og pudset er løst, så der kommer vand ind i facaden. Ved frost bliver skaden kun værre.\n\nVil I gøre noget ved det nu, mens stilladset er oppe?",
    createdAt: "2026-09-03T10:35:00.000Z",
    status: "issued",
    answered: false,
    photoIds: ["fld-tf-have-01", "fld-tf-have-02", "fld-tf-have-03", "fld-tf-have-04", "fld-tf-have-05", "fld-tf-have-06", "fld-tf-have-07"],
  },
];

export const SEED_ENTS: Entrepreneur[] = [];

export const SEED_PACKS: InvoicePack[] = [];

export const SEED_KS_REPORTS: KsReport[] = [
  { id: "ksr-grok-55-1sal", number: "Z-KS-2026-004", projectId: "job-hillerodsholm", point: "5.5", createdAt: "2026-09-03T10:29:40.000Z", status: "issued", deviations: "Ingen afvigelser.", approved: true, employeeName: "Grok", crew: "Ole, Grok", process: "Murerarbejde", trade: "Murer", company: FIRM, photoIds: ["1ZiKbWqeeoq0Tl_jGrvyLjHfccUKJ9t-6", "1pmEghtJJ1klHdeatbY3Ma94z-RBB508b", "1wn6gDMv1o3ABgimwghhULCjv8moWrwgD", "1XxryT0Z1cvb0OAbhJs5p1s54WhU8VIQU", "1w7i1dYdCWqVZUWPhRMmg_PXFxerBIHah", "18M5QHnAXopHOIFlkCvGn3syPp-KXoKI5", "1vybpC40GeNarX0wImi1s-q79Y7ab0C2d", "1l42MCrHMZV5mw0EES-ZigQAZJ3h9vv1D", "1yQYQRAbXS6xgQzF5fCfQATG2-i-gto4y", "1GWlyBxvF31wIej_UrQ8fvpl8vVm6aF7d", "1sHtKJiFTXFprT09Rjpq3QqjSkir8ziz2", "1rcF9Zf9JhvPBXqffwRCgZ3K5IVA5l_ra", "1egirDQvCtKZOGUTpyOnbc-uWNy4rQXqu", "1JjEWGiJDbnhVg5VxhA-uGf2sp2b6d0Q2", "1pJCxXZhwOGiteRR0SbBhIqm6sP7wqXwe", "1Hiy6VsZq5XRJEN_Pos3V0efJ4-zlplI9", "1hFFKifft3iFfkbPd3_HDxsqpwnUOYMF3", "1tHa2kaTDT27LECyc5eUyt-rBlcmWyvVr", "15U2PIg_1XRyEeuJ98BgwlEgFdr0aLD4d", "1i9umuTZmLDTc6TO1jmVZ8TbZVdOpPZYe"] },
  { id: "ksr-grok-55", number: "Z-KS-2026-003", projectId: "job-hillerodsholm", point: "5.5", createdAt: "2026-09-03T10:21:00.000Z", status: "issued", deviations: "Ingen afvigelser.", approved: true, employeeName: "Grok", crew: "Ole, Grok", process: "Murerarbejde", trade: "Murer", company: FIRM, photoIds: ["1er3uUXDcvMM352r76VmgOIH8IXYMhQoe", "1SDfetli4LgyLAnDPgKvwCMf7DO6_0yVr", "1qT7i9nHSiDwhIDTYIhmkKkBBsSc-hmWm", "1a_fnHRNdPvGBA0cpHXv1EWDwXYtjfYtp", "1fWgCnVgLo_oS-uqJYnPkg-EfqL2RvJco", "1DUJiTZX8Bd2Riv7SjADsUZDHg5-1FF5C"] },
];

export const FLOORS = ["Stuen", "1. sal", "2. sal", "Kælder", "Tag"] as const;
export const ROOMS = ["Facade øst", "Facade vest", "Gavl nord", "Gavl syd", "Trappe", "Sokkel", "Altan", "Skorsten"] as const;

export function crewOnJob(projectId: string, employees: Employee[], assignments: Assignment[]) {
  const ids = new Set(assignments.filter((a) => a.projectId === projectId).map((a) => a.employeeId));
  return employees
    .filter((e) => ids.has(e.id))
    .sort((a, b) => {
      const rank = (id: string) => (id === "emp-ole" ? 0 : id === "emp-federico" ? 1 : 100);
      const ra = rank(a.id);
      const rb = rank(b.id);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, "da");
    });
}

export function ensureMastersOnJobs(state: { projects: Project[]; assignments: Assignment[] }) {
  const have = new Set(state.assignments.map((a) => `${a.employeeId}|${a.projectId}`));
  const extra: Assignment[] = [];
  for (const p of state.projects) {
    if (p.status !== "active") continue;
    for (const id of MASTER_IDS) {
      const k = `${id}|${p.id}`;
      if (have.has(k)) continue;
      extra.push({ employeeId: id, projectId: p.id });
      have.add(k);
    }
  }
  if (extra.length) state.assignments = [...state.assignments, ...extra];
  return state;
}

export function copenhagenDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen" }).format(d);
}
export function copenhagenTime(iso: string) {
  return new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
export function copenhagenDateTime(iso: string) {
  return new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
export function dayKey(employeeId: string, date = copenhagenDate()) {
  return `${employeeId}:${date}`;
}
export function hoursWorked(
  log: {
    checkInAt: string | null;
    checkOutAt: string | null;
    pauseMinutes: number;
    pauseStartedAt: string | null;
    payrollMinutes?: number;
  },
  now = Date.now(),
) {
  if (typeof log.payrollMinutes === "number") return log.payrollMinutes / 60;
  if (!log.checkInAt) return 0;
  const end = log.checkOutAt ? new Date(log.checkOutAt).getTime() : now;
  let pause = log.pauseMinutes;
  if (log.pauseStartedAt) pause += (now - new Date(log.pauseStartedAt).getTime()) / 60000;
  return Math.max(0, (end - new Date(log.checkInAt).getTime()) / 3600000 - pause / 60);
}

export function suggestKsPoint(text: string, projectId?: string) {
  const q = text.toLowerCase();
  if (projectId === "job-hillerodsholm") {
    if (/altan|balkon|hul i mur|reparation/.test(q)) return "5.4";
    if (/fils|vange|puds/.test(q)) return "5.5";
    if (/inddæk|inddaek|skorsten/.test(q)) return "5.7";
    if (/binder|iboring|ø4|rustfri/.test(q)) return "5.6";
    if (/tag|vinge|tegl.?36/.test(q)) return "5.8";
    if (/omfug|udfræs|kkh|trykket|fuge/.test(q)) return "5.7";
    if (/hulmur|indblæs|stenuld|lambda|isol/.test(q)) return "5.3";
    if (/demonter|rens/.test(q)) return "5.2";
    if (/opmur|hul/.test(q)) return "5.4";
    if (/slut|finish|rengøring/.test(q)) return "6.1";
    return "5.3";
  }
  if (/isol|mineraluld|flexibatts|190/.test(q)) return "3.1";
  if (/membran|sokkel|fugt/.test(q)) return "5.1";
  if (/fuge|fugning/.test(q)) return "2.2";
  if (/overligger|hea/.test(q)) return "4.1";
  if (/afdæk|afdaek|regn/.test(q)) return "6.1";
  return "2.1";
}

const DOC_STOP = new Set([
  "hvilken",
  "hvilket",
  "hvilke",
  "hvem",
  "hvad",
  "hvor",
  "hvordan",
  "hvorfor",
  "er",
  "en",
  "et",
  "den",
  "det",
  "de",
  "og",
  "i",
  "på",
  "til",
  "af",
  "for",
  "med",
  "som",
  "der",
  "jeg",
  "vi",
  "du",
  "man",
  "skal",
  "kan",
  "må",
  "leverer",
  "levere",
  "bruge",
  "bruges",
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "to",
  "qué",
  "que",
  "cuál",
  "cual",
  "quién",
  "quien",
  "el",
  "la",
  "los",
  "las",
]);

export function docTokens(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[?.,!;:()«»""]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !DOC_STOP.has(w));
}

function scoreDoc(d: DocHit, words: string[]): number {
  const title = d.title.toLowerCase();
  const blob = `${d.title} ${d.excerpt} ${d.keywords.join(" ")}`.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (d.keywords.some((k) => k === w || (k.length >= 4 && (k.includes(w) || (w.length >= 5 && w.includes(k)))))) score += 5;
    else if (title.includes(w)) score += 4;
    else if (blob.includes(w)) score += 1;
  }
  return score;
}

export function searchDocs(q: string, projectId?: string): DocHit[] {
  const words = docTokens(q);
  if (!words.length) return [];
  if (projectId && projectId !== "job-hillerodsholm") return [];
  return DOCS.map((d) => ({ d, score: scoreDoc(d, words) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.d);
}

export function answerDocs(q: string, projectId?: string): { hit: DocHit; line: string } | null {
  if (projectId) {
    const local = snippetFromCorpus(projectId, q);
    if (local) {
      const hit: DocHit = { id: `udbud-${local.name}`, title: local.title, page: local.page, excerpt: local.excerpt, keywords: [] };
      return { hit, line: `${local.excerpt} (${local.name})` };
    }
  }
  const hits = searchDocs(q, projectId);
  if (hits.length) {
    const hit = hits[0]!;
    return { hit, line: `${hit.excerpt} (${hit.title}, ${hit.page})` };
  }
  if (!projectId) return null;
  const words = docTokens(q);
  if (!words.length) return null;
  const planHit = controlPlanFor(projectId).find((p) => {
    const blob = `${p.code} ${p.title} ${p.hint} ${p.criteria} ${p.qcScope}`.toLowerCase();
    return words.some((w) => blob.includes(w));
  });
  if (!planHit) return null;
  const hit: DocHit = {
    id: `plan-${planHit.code}`,
    title: `${planHit.code} ${planHit.title}`,
    page: "kontrolplan",
    excerpt: `${planHit.hint} ${planHit.criteria}`,
    keywords: [],
  };
  return { hit, line: `${planHit.code} ${planHit.title}: ${planHit.hint} ${planHit.criteria}` };
}


export const SEED_TODOS: Todo[] = [
  {
    id: "td-lang-ion",
    projectId: "job-hillerodsholm",
    assigneeId: "emp-ion",
    assigneeIds: ["emp-ion"],
    fromId: "emp-ole",
    title: "Ryd bag skuret",
    body: "Ryd bag skuret i morgen — Hillerødsholm.",
    original: "Ryd bag skuret i morgen — Hillerødsholm.",
    sourceLang: "da",
    kind: "task",
    due: "2026-09-06",
    done: false,
    createdAt: "2026-09-05T08:10:00.000Z",
    lat: 55.9298,
    lng: 12.3105,
    gpsLabel: "55.92980, 12.31050 · sag",
    translations: {
      da: "Ryd bag skuret i morgen — Hillerødsholm.",
      ro: "Curăță în spatele șopronului mâine — Hillerødsholm.",
      es: "Limpia detrás del cobertizo mañana — Hillerødsholm.",
      pl: "Posprzątaj za szopą jutro — Hillerødsholm.",
      uk: "Прибери за сараєм завтра — Hillerødsholm.",
      de: "Räume morgen hinter dem Schuppen auf — Hillerødsholm.",
      en: "Clear behind the shed tomorrow — Hillerødsholm.",
    },
  },
  {
    id: "td-ryd-stillads",
    projectId: "job-hillerodsholm",
    assigneeId: "emp-ole",
    assigneeIds: ["emp-ole"],
    fromId: "emp-ole",
    title: "Ryd stillads",
    body: "Ryd stillads på Hillerødsholm.",
    kind: "task",
    due: "",
    done: false,
    createdAt: "2026-09-08T08:00:00.000Z",
  },
];
export const SEED_NOTES: MemoryNote[] = [];

const PLAN_AT = "2026-09-04T09:20:00.000Z";
function seedPlan(id: string, employeeId: string, projectId: string, title: string, start: string, end: string): PlanBlock {
  return { id, employeeId, projectId, title, start, end, createdAt: PLAN_AT, createdBy: "emp-ole", source: "bot" };
}

export const SEED_PLANS: PlanBlock[] = [
  seedPlan("pl-w37-marius-islev", "emp-marius", "job-islevvaenge", "Puds gavle", "2026-09-07", "2026-09-07"),
  seedPlan("pl-w37-ole-islev", "emp-ole", "job-islevvaenge", "Puds gavle", "2026-09-07", "2026-09-07"),
  seedPlan("pl-w37-alex-islev", "emp-alex", "job-islevvaenge", "Puds gavle", "2026-09-07", "2026-09-07"),
  seedPlan("pl-w37-marius-soren", "emp-marius", "job-soren-privat", "Udførsel", "2026-09-08", "2026-09-08"),
  seedPlan("pl-w37-ole-prove", "emp-ole", "job-provestenen", "Puds kælder", "2026-09-08", "2026-09-09"),
  seedPlan("pl-w37-alex-prove", "emp-alex", "job-provestenen", "Puds kælder", "2026-09-08", "2026-09-09"),
  seedPlan("pl-w37-fede-kloster", "emp-federico", "job-klostergaarden", "Udførsel", "2026-09-07", "2026-09-11"),
  seedPlan("pl-w37-osva-kloster", "emp-osvaldo", "job-klostergaarden", "Udførsel", "2026-09-07", "2026-09-11"),
];

const WEEK37_JOB_IDS = ["job-soren-privat", "job-klostergaarden", "job-provestenen"] as const;

export function ensureBotWeek37(state: { projects: Project[]; assignments: Assignment[]; plans: PlanBlock[] }) {
  const haveId = new Set(state.projects.map((p) => p.id));
  const haveName = new Set(state.projects.map((p) => p.name.toLowerCase()));
  for (const p of PROJECTS) {
    if (!WEEK37_JOB_IDS.includes(p.id as (typeof WEEK37_JOB_IDS)[number])) continue;
    if (haveId.has(p.id) || haveName.has(p.name.toLowerCase())) continue;
    state.projects = [p, ...state.projects];
    haveId.add(p.id);
  }
  const aKey = (a: Assignment) => `${a.employeeId}|${a.projectId}`;
  const haveA = new Set(state.assignments.map(aKey));
  for (const a of ASSIGNMENTS) {
    if (!WEEK37_JOB_IDS.includes(a.projectId as (typeof WEEK37_JOB_IDS)[number]) && !(a.employeeId === "emp-marius" && a.projectId === "job-islevvaenge") && !(a.employeeId === "emp-alex" && a.projectId === "job-islevvaenge")) {
      continue;
    }
    if (haveA.has(aKey(a))) continue;
    state.assignments = [...state.assignments, a];
    haveA.add(aKey(a));
  }
  const pKey = (b: PlanBlock) => `${b.employeeId}|${b.start}|${b.end}|${b.projectId}|${b.title}`;
  const haveP = new Set(state.plans.map(pKey));
  for (const b of SEED_PLANS) {
    if (haveP.has(pKey(b))) continue;
    state.plans = [...state.plans, b];
    haveP.add(pKey(b));
  }
  return state;
}

type PidRow = { projectId?: string };

function aliasNameTarget(name: string): string | null {
  const n = name.toLowerCase();
  if (/ruskær|ruskaer/.test(n)) return "job-kaerhuset";
  if (/strandvej/.test(n) && !/prøvesten|provesten/.test(n)) return "job-provestenen";
  return null;
}

function patchPid(rows: unknown, remap: (id: string) => string) {
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    if (!row || typeof row !== "object" || !("projectId" in row)) continue;
    const r = row as PidRow;
    if (typeof r.projectId === "string") r.projectId = remap(r.projectId);
  }
}

export function mergeAliasJobs(state: { projects: Project[]; assignments: Assignment[]; [key: string]: unknown }) {
  const kaer =
    state.projects.find((p) => p.id === "job-kaerhuset" || /^kærhuset|^kaerhuset/i.test(p.name)) ??
    PROJECTS.find((p) => p.id === "job-kaerhuset");
  const prove =
    state.projects.find((p) => p.id === "job-provestenen" || /prøvesten|provesten/i.test(p.name)) ??
    PROJECTS.find((p) => p.id === "job-provestenen");
  if (kaer && !state.projects.some((p) => p.id === kaer.id)) state.projects = [kaer, ...state.projects];
  if (prove && !state.projects.some((p) => p.id === prove.id)) state.projects = [prove, ...state.projects];
  const kaerId = kaer?.id ?? "job-kaerhuset";
  const proveId = prove?.id ?? "job-provestenen";

  const map: Record<string, string> = {
    "job-strandvejen": proveId,
    "job-ruskaer": kaerId,
  };
  const drop = new Set<string>();
  for (const p of state.projects) {
    const to = PROJECT_ALIASES[p.id] ? (p.id === "job-ruskaer" ? kaerId : p.id === "job-strandvejen" ? proveId : PROJECT_ALIASES[p.id]) : aliasNameTarget(p.name);
    if (to && to !== p.id) {
      map[p.id] = to;
      drop.add(p.id);
    }
  }
  const remap = (id: string) => map[id] ?? PROJECT_ALIASES[id] ?? id;

  const seedProve = PROJECTS.find((p) => p.id === "job-provestenen")!;
  const seedKaer = PROJECTS.find((p) => p.id === "job-kaerhuset")!;
  state.projects = state.projects
    .filter((p) => !drop.has(p.id))
    .map((p) => {
      if (p.id === proveId || /prøvesten|provesten/i.test(p.name)) {
        return {
          ...p,
          address: seedProve.address,
          lat: seedProve.lat,
          lng: seedProve.lng,
          brief: seedProve.brief,
        };
      }
      if (p.id === kaerId || /^kærhuset|^kaerhuset/i.test(p.name)) {
        return { ...p, brief: seedKaer.brief };
      }
      return p;
    });

  const patch = (rows: unknown) => patchPid(rows, remap);
  patch(state.plans);
  patch(state.todos);
  patch(state.issues);
  patch(state.slips);
  patch(state.tfs);
  patch(state.ents);
  patch(state.packs);
  patch(state.ksReports);
  patch(state.docs);
  patch(state.notes);
  patch(state.cal);
  patch(state.chats);
  patch(state.threads);
  patch(state.logs);
  if (Array.isArray(state.fieldItems)) {
    for (const item of state.fieldItems) {
      if (!item || typeof item !== "object") continue;
      const row = item as PidRow & { projectName?: string };
      if (row.projectId) row.projectId = remap(row.projectId);
      if (row.projectName && /strandvej/i.test(row.projectName)) row.projectName = seedProve.name;
      if (row.projectName && /ruskær|ruskaer/i.test(row.projectName)) row.projectName = seedKaer.name;
    }
  }
  if (state.days && typeof state.days === "object") {
    for (const d of Object.values(state.days as Record<string, DayLog>)) {
      d.projectId = remap(d.projectId);
      for (const ph of d.photos ?? []) {
        ph.projectId = remap(ph.projectId);
        if (/strandvej/i.test(ph.projectName)) ph.projectName = seedProve.name;
        if (/ruskær|ruskaer/i.test(ph.projectName)) ph.projectName = seedKaer.name;
      }
    }
  }

  const seen = new Set<string>();
  state.assignments = state.assignments
    .map((a) => ({ ...a, projectId: remap(a.projectId) }))
    .filter((a) => {
      const k = `${a.employeeId}|${a.projectId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  const remapKeys = (rec: unknown) => {
    if (!rec || typeof rec !== "object") return rec;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec as Record<string, unknown>)) out[remap(k)] = v;
    return out;
  };
  if (state.inboxFolders) state.inboxFolders = remapKeys(state.inboxFolders);
  if (state.driveMaps) state.driveMaps = remapKeys(state.driveMaps);
  return state;
}

export const SEED_CAL: CalEvent[] = [
  {
    id: "cal-altan-0903",
    projectId: "job-hillerodsholm",
    title: "Projektafklaringsmøde: altanbæringer",
    at: "2026-09-03T12:00:00.000Z",
    kind: "meeting",
    where: "Hillerødsholm, pladsen",
    source: "seed",
  },
  {
    id: "cal-bm-0909",
    projectId: "job-hillerodsholm",
    title: "Byggemøde Hillerødsholm",
    at: "2026-09-09T07:30:00.000Z",
    kind: "meeting",
    where: "Kontorskur, Selskovvej",
    source: "seed",
  },
  {
    id: "cal-sik-0916",
    projectId: "job-hillerodsholm",
    title: "Sikkerhedsmøde nr. 10",
    at: "2026-09-16T07:30:00.000Z",
    kind: "meeting",
    where: "Hillerødsholm",
    source: "seed",
  },
  {
    id: "cal-altan-0901",
    projectId: "job-hillerodsholm",
    title: "Teams: understøtninger til altaner",
    at: "2026-09-01T07:00:00.000Z",
    kind: "meeting",
    where: "Teams",
    source: "seed",
  },
];
export const SEED_CHATS: ChatMessage[] = [
  {
    id: "ch-lang-ion",
    at: "2026-09-05T08:12:00.000Z",
    fromId: "emp-ion",
    to: { kind: "employees", ids: ["emp-osvaldo", "emp-ole"] },
    projectId: "job-hillerodsholm",
    sourceLang: "ro",
    original: "Am curățat spatele șopronului pe Hillerødsholm.",
    translations: {
      ro: "Am curățat spatele șopronului pe Hillerødsholm.",
      da: "Jeg har ryddet bag skuret på Hillerødsholm.",
      es: "He limpiado detrás del cobertizo en Hillerødsholm.",
      pl: "Posprzątałem za szopą na Hillerødsholm.",
      uk: "Прибрав за сараєм на Hillerødsholm.",
      de: "Ich habe hinter dem Schuppen auf Hillerødsholm aufgeräumt.",
      en: "I cleared behind the shed at Hillerødsholm.",
    },
    viaVoice: false,
    threadId: "thr-lang-ro-es",
  },
  {
    id: "ch-lang-osvaldo",
    at: "2026-09-05T08:14:00.000Z",
    fromId: "emp-osvaldo",
    to: { kind: "employees", ids: ["emp-ion", "emp-ole"] },
    projectId: "job-hillerodsholm",
    sourceLang: "es",
    original: "Visto. Lo dejo listo en Hillerødsholm.",
    translations: {
      es: "Visto. Lo dejo listo en Hillerødsholm.",
      da: "Set. Jeg gør det færdigt på Hillerødsholm.",
      ro: "Văzut. Îl las gata pe Hillerødsholm.",
      pl: "Widzę. Dokończę to na Hillerødsholm.",
      uk: "Бачу. Закінчу це на Hillerødsholm.",
      de: "Gesehen. Ich mache es auf Hillerødsholm fertig.",
      en: "Seen. I'll finish it at Hillerødsholm.",
    },
    viaVoice: false,
    threadId: "thr-lang-ro-es",
  },
  {
    id: "ch-mat-ion",
    at: "2026-09-05T09:40:00.000Z",
    fromId: "emp-ion",
    to: { kind: "masters" },
    projectId: "job-islevvaenge",
    sourceLang: "da",
    original: "Mangler mørtel, brædder og afdækning.",
    translations: {
      da: "Mangler mørtel, brædder og afdækning.",
      ro: "Lipsește mortar, scânduri și acoperire.",
      es: "Falta mortero, tablones y cobertura.",
    },
    viaVoice: false,
  },
];

export const SEED_NEEDS: MaterialNeed[] = [
  {
    id: "nd-mat-ion",
    chatId: "ch-mat-ion",
    projectId: "job-islevvaenge",
    fromId: "emp-ion",
    keywords: ["mørtel", "brædder", "afdækning"],
    text: "Mangler mørtel, brædder og afdækning.",
    at: "2026-09-05T09:40:00.000Z",
    status: "need",
  },
];
export const SEED_LOGS: YardLog[] = [];

export function seedTodayDays(): Record<string, DayLog> {
  return seedOsvaldoDatalon(copenhagenDate());
}

function seedOsvaldoDatalon(today: string): Record<string, DayLog> {
  const out: Record<string, DayLog> = {};
  for (const row of OSVALDO_DATALON) {
    if (row.date === today) continue;
    const start = `${row.date}T05:00:00.000Z`;
    const end = new Date(new Date(start).getTime() + row.minutes * 60_000).toISOString();
    out[dayKey("emp-osvaldo", row.date)] = {
      employeeId: "emp-osvaldo",
      date: row.date,
      projectId: row.projectId,
      checkInAt: start,
      checkOutAt: end,
      pauseStartedAt: null,
      pauseMinutes: 0,
      photos: [],
      gpsInside: true,
      checkInGps: seedFix(row.projectId, start, 0),
      checkOutGps: seedFix(row.projectId, end, 1),
      demoGps: false,
      status: "exported",
      workNote: row.note,
      source: "datalon",
      payrollMinutes: row.minutes,
      payrollNo: row.payrollNo,
      doubleBooked: row.doubleBooked,
    };
  }
  return out;
}
