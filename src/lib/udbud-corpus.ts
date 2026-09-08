import { expandQueryWords, stemDa } from "./udbud-synonyms.ts";

/** Tekst hentet fra 01 Udbudsmateriale. Ansatte søger her via sag-bot. */
export const UDBUD_CORPUS: Record<string, { name: string; text: string }[]> = {
  "job-hillerodsholm": [
    {
      name: "K01_C08_002_Murer.pdf",
      text: `K01_C08_002_Murer. Hillerødsholm udbud 06.01.2025. Arbejdsbeskrivelse 240 Murværk.

Eksisterende facader er 360 mm murværk, røde massive maskinsten, muret i krydsforbandt i strandmørtel med trykket fuge.
Murværk er fuld mur i stuen og hul mur på 1. sal og 2. sal. Gavle og vinduesbrystninger er hul mur.
Ved etageadskillelser, ventilationskanaler, døre og vinduer, indmuringer ved altaner og mod tag er murværket massivt.

10.02.02 Efterisolering hulmur.
Omfang: Udtagning og indmuring af sten for indblæsning af isolering. Hulmursisolering af gavle og facader med hulmur.
Lokalisering: Gavle på blok A og blok B. Facader på 1. og 2. sal på blok A og blok B. Indmuringer ved altaner og murværk ud for WC-rum er fuldmuret og kan ikke efterisoleres.
Isoleringsmaterialer A. Anvendelse: Hulmursisolering. Maksimal varmeledningsevne: λD = 37 mW/mK. Type: Stenuld.
Indblæsning af stenuldsgranulat foretages udefra gennem hullerne fra de udtagne sten. Skal udføres af autoriseret firma godkendt af leverandøren.
Sten fjernes i ydermuren med 1½-2 meters mellemrum. Murværk må ikke afsyres. Der skal mures rent.
Mørtel til opmuring: Hydraulisk kalkmørtel KKh 35/65/500, aggressiv, strandsand 0–4 mm.

10.02.03 Iboring af renoveringsbindere.
Iboring af nye murbindere min. 4 stk. pr. kvm, 2 m fra hjørner dog min. 6 stk. pr. kvm. Omkring åbninger og ved øverste binderrække ekstra bindere.
Bindere med selvskærende gevind med bølgeanker. Ø4 mm korrosionsfaste bindere i rustfrit stål. Længde min. 145 mm + hulrum.
Bindere skrues min. 75 mm ind i bagmuren. Faststøbes i formuren med klæbemasse. Klæbemassen tilbageholdes min. 25 mm fra facaden.

10.02.04 Omfugning af murværk.
Udfræsning af alle fuger i en dybde af min. 20 mm. Omfugning af facader og gavle, trykket fuge.
Alle facader og gavle på blok A og blok B. Eksisterende murværk har varierende fugebredder og knasfuger.
Kalkmørtel må kun benyttes ved temperaturer over 5 °C.

10.02.01 Puds og reparation af vægge ved altaner.
Grundpuds CE-mærket, diffusionsåben, egnet til armeringsnet. Slutpuds hvid, samme producent. Filses med vådt filsebræt.

10.02.09 Sålbænke, nedrivning, leverance og montage, OPTION.
Materialer og produkter der skal godkendes inden levering: Byggesten/teglsten, mørtel til opmuring, puds og fugning.`,
    },
    {
      name: "K01_C08_000_03_Stillads.pdf",
      text: `K01_C08_000_03_Stillads. Hillerødsholm udbud 06.01.2025. Arbejdsbeskrivelse 100 Byggeplads, stillads.
Bygningsdele: 00.03.01 Stilladser, 00.03.02 Leje af stilladser, person- og materialeelevatorer, ladetårne, opgangsfelter, inddækning, totaloverdækning.
Stillads defineres som midlertidig konstruktion til understøtning, adgangsvej og arbejdsplatform.
Arbejdsstilladser skal opstilles i overensstemmelse med stilladsleverandørens brugsanvisning.
Generelt vedr. stilladser henvises til BSB og PSS.
Stillads på Hillerødsholm leveres og flyttes af HAKI. Zenko rører ikke fodplader eller stillads uden HAKI.
Koordinering med facade, hulmursisolering, omfugning og tag. Totaloverdækning indgår.`,
    },
    {
      name: "K01_C08_000_02_Byggeplads.pdf",
      text: `K01_C08_000_02_Byggeplads. Hillerødsholm. Byggeplads, oplag, affald just-in-time, teltværksteder efter byggepladsplan. Beskyttende foranstaltninger inden arbejde påbegyndes.`,
    },
  ],
  "job-islevvaenge": [
    {
      name: "ISV_K01_C08.2_Zmur - Murer.pdf",
      text: `ISV_K01_C08.2_Zmur. Islevvænge, Rødovre Almennyttige Boligselskab v/ DAB. Arbejdsbeskrivelse – Murer. 03.07.2020, rev. 23.11.2020. Molio 4.240. DOMUS/DOMINA.

Boligtyper: G/GT/GS gule huse. RF Fortvej røde huse. RK Knudsbølvej røde huse.

2. Omfang — murer i gule og røde huse:
Udskiftning af mursten og omfugning af eksisterende murede ydervægge.
Opmuring af nye indvendige mursten- og porebetonvægge.
Blænding og hultagning i murstensvægge og ydervægge.
Ny puds og pudsreparationer på indvendige vægge.
Lægning af flisegulve inkl. vådrumssikring. Etablering af sålbænke.
Udbedring af sokkelpuds samt tætning af murede sokler på gule huse.
Puds på nye sokler til udestuer.
Pudsning af gavle røde huse, Fortvej.

213.104 Udbedring af murværk og fuger, facader gule huse.
Omfang: udbedring af murværk, udkradsning af fuger og omfugning på alle facader og gavle, inkl. muret sokkel. Inkl. udskiftning af beskadigede sten, estimeret 3 % af facadearealet. Inkl. false i fuld dybde langs alle vinduer og døre.
Lokalisering: gule rækkehuse, boligtype G, GS og GT. Facader og gavle.
Sten: hårdtbrændt, blødstrøgen, massiv teglsten. T2, min. 30 MPa, F2, S0, A1, 1600 kg/m³, MX3.2. Fugetype: skrabefuge.
Mørtel til opmuring og fugning: KC 50/50/700, fm=0,9 MPa.
Udførelse: alle ligge- og studsfuger udkradses i fuldt tværsnit til 20 mm med langsom elektrisk fugefræser + støvsuger. Fræsehoved 1–2 mm mindre end fugen. Stenene må ikke beskadiges.
Beskadigede sten udtages i fuld dybde, nye sten imures. Studsfuger der ikke er fyldt skal efterfyldes.
Forvanding med forstøver — ikke vandslange. Fuger 100 % fyldte. Efter afhærdning afkostes diagonalt med stiv kost. Ingen fugeslør.
Murværk må ikke afsyres.
Prøve: baghaveside mellem vindue i stue og terrasse, fra terræn til tagfod. 3 nuancer af nye sten til godkendelse.
Kontrol: udbudskontrolplan. KS-dokumentation iht. IKT-ydelsesbeskrivelse.

213.202 Udbedring af murværk og fuger, facader røde huse.
Omfang: udbedring, udkradsning og omfugning på alle facader, inkl. murværk i kælderskakt. 3 % stenudskiftning. False i fuld dybde.
Vandskuring med indfarvet puds på sidevægge på karnapper (tidligere udestuer/overdækninger), type RF.
Lokalisering: samtlige røde huse — facader. Vandskuring: RF karnap-sidevægge.
Sten: som eksisterende, T2, 30 MPa, F2, MX3. Skrabefuge.
Mørtel opmuring/fugning: KC 50/50/700, fm=0,9 MPa, indfarvet rød som eksisterende.
Vandskuring: indfarvet KC 50/50/490, hydratkalk, portlandcement, 0–1 mm kvartssand. Indfarvet rød som eksisterende filts på gavle.
Udførelse fuger: samme som 213.104 — 20 mm, fugefræser, forstøver, 100 % fyldte, ingen afsyring.
Vandskuring på gavle og sidevægge: underlaget forvandes, mørtel så tyndt som muligt med stålbræt. Færdig overflade jævn, flest mulige murstensflader uden mørteldækning, kun antydning af bindemiddel.
Ingen antifrostmidler uden skriftlig accept fra byggeledelsen.
Prøve: 1 facade mod terrasse (udkradsning, udbedring, omfugning). 1 gavl/sidevæg på karnap (inkl. filtsning). Filtsemørtel til filtsning på gavle skal kommenteres inden prøve.

127.102 Reparation af sokkelpuds gule huse. 127.101 Beskyttelse/tætning af murede sokler gule huse.

Materialer og udførelse i øvrigt: Teknologisk Institut / mur-tag.dk.`,
    },
    {
      name: "ISV_K01_C08.2_Ztag - Tagarbejder.pdf",
      text: `ISV_K01_C08.2_Ztag. Islevvænge, Rødovre Almennyttige Boligselskab v/ DAB. Arbejdsbeskrivelse – Tagarbejder. 03.07.2020, rev. 23.11.2020. Molio 4.360.

2. Omfang — tag:
Forstærkninger og opretninger af spær. Ombygning og nye tagkonstruktioner. Isolering. Undertage. Tagbelægninger.
Murerarbejder i forbindelse med tage og udbedringer af murværk skorsten.
Blikkenslagerarbejde. Inddækninger, tagrender, tagfod. Gennemføringer og taghætter.

472.101 Skifertage gule huse.
472.201 Tegltag røde huse.
319.10 Tagfod gule huse. 319.20 Tagfod røde huse.
376.11 Tagrender og nedløb. 376.01 Inddækninger. 376.31 Ventilationshætte til skorsten.

213.103 Ekstra murværk ved tag — gule huse.
Opmuring af ekstra murværk langs tag på alle facader, sidevægge og gavle (ca. 2 skifter).
Inkl. fjernelse af tildannede sten langs gavle og løse sten. Inkl. udkradsning og fugning. Inkl. tildannelse af nye sten langs gavle og sidevægge.
Lokalisering: samtlige gule huse G, GT, GSA, GSB. Murværk ved tagfod og langs gavle.
Sten: hårdtbrændt, blødstrøgen, massiv tegl. T2, 30 MPa, F2, MX3.2. Skrabefuge.
Mørtel opmuring og fugning: KC 20/80/550, 0–4 mm tilslag.
Fugning i samme arbejdsgang som 213.104 (udbedring og fugning gule huse).
Forvanding med forstøver, 100 % fyldte fuger, diagonal afkostning, må ikke afsyres.
Prøve: 1 gavl og 1 facade.

213.203 Ekstra murværk og forskelling ved tag — røde huse.
Ekstra murværk langs tag på facader (2 skifter) plus ekstra murværk og forskelling langs gavle.
Inkl. filtsning af nyt murværk og forskelling.
Koordineres med 213.202 (udbedring fuger røde) og 472.201 tegltag.
Sten som eksisterende. Skrabefuge. Indfarvet mørtel. Forskelling: hydraulisk kalkmørtel KKh 20/80/475.
Filtsning af nyt murværk på gavle.

213.101 Udbedring af skorsten gule huse. 213.201 Udbedring af skorsten røde huse.
To løsninger pr. skorsten:
213.101.1 / 213.201.1 (estimeret 85 %): fjern betonplade og betonkrone. Udkradsning og omfugning af eksisterende mursten inkl. udskiftning af beskadigede sten, fra loft til skorstenskrone. Fjern renselem i stueetage og tilmur.
213.101.2 / 213.201.2 (estimeret 15 %): nedtagning og opmuring af ny skorsten fra loft til krone. Samme renselem-tilmuring.
Udførelse omfug: fuger 20 mm, fugefræser + støvsuger. Ny skorsten: fyldte fuger, opbukket paplag i første skifte over inddækning. Udkradsning min. 13 mm fra færdig fugeoverflade før efterfugning.
Forvanding med forstøver, ingen vandslange, ingen afsyring.
Top af skorsten afrettes med multiklæb eller tyndpuds som underlag for ståltagkrone.
Sten: hårdtbrændt, blødstrøgen, massiv tegl.

Kontrol: udbudskontrolplan. KS iht. IKT-ydelsesbeskrivelse.`,
    },
  ],
  "job-kaerhuset": [
    {
      name: "11ARBE~1- murer arbejde.PDF",
      text: `Kærhuset - Ruskær 35, Ombygning. Hovedentreprise. ARBEJDSBESKRIVELSE 1.1 Murerarbejdet. Udgivelsesdato 26.08.2025. Sag 25.004. Udarbejdet FSE.

Indholdsfortegnelse:
4. Bygningsdelsbeskrivelse
1.1.1 Fundamenter
1.1.2 Sokkel
1.1.3 Sokkelaffugter
1.1.4 Terrændæk – Eksisterende terrændæk
1.1.5 Terrændæk – Ny terrændæk
1.1.6 Ydervæg, eksist. murværk
1.1.7 Sålbænke under vinduer
1.1.8 Indervæg, eksist. murværk
1.1.9 Vådrum

2.2 Bygningsdele
Entreprisen omfatter følgende bygningsdele:
• 1.1.1 Fundamenter
o 121-001 Stribe- og punktfundamenter
• 1.1.2 Sokkel
o 412-001 Reparation og puds
o Sokkeltilpasning ved nye døre og vinduer
• 1.1.3 Sokkelaffugter
o 303-001 Sokkelaffugter
• 1.1.4 Terrændæk – Eksisterende terrændæk
o Eksist. terrændæk opbrydes og udskæring til gulvmåtte
• 1.1.5 Terrændæk – Ny terrændæk
o 131-001 Ny terrændæk
o Udstøbning af gulvbeton ved nye udv. døre og vinduer
• 1.1.6 Ydervæg, eksist. murværk
o 213-001 Tilmuring og puds indv. af åbninger efter ventilationsriste
o 219-001 Opmuring rulleskifte ved gavl
o Udskiftning af mursten
o Indboret binder
o Omfugning af eksist. murværk
o Udførelse af facadeåbninger for montering af ny facadedør
• 1.1.7 Sålbænke under vinduer
o Udskiftning af betonsålbænk under vinduer
• 1.1.8 Indervæg, eksist. murværk
o 223-001 Indv. opmuring og puds
o 422-001 Indv. puds
o Udvidelse af eksist. indv. døre (tegloverliggere)
o Nedrivning af indvendig gavl i eksist. Motorikrum og Fællesrum
o Nedbrydning af eksist. vægfliser samt fliselim
o Udskiftning af overligger
• 1.1.9 Vådrum
o 422-002 Vægfliser

1.1.1 Fundamenter
4.2 Omfang: udgravning og etablering af stribefundamenter og punktfundamenter. Garderobe B, Hygiejnerum 2, trapperum.
4.14 Kontrol: Entreprenøren kontrollerer mål, placering og armering inden udstøbning. Armering inspiceres og godkendes af ingeniøren før betonpåføring.

1.1.2 Sokkel
4.2 Omfang: 412-001 Reparation og pudsning af udv. eksist. sokkel. Sokkeltilpasning ved nye døre og vinduer.
Puds: Udkast C 100/400. Slutpuds KC 20/80/550. Pudsning af sokler fra overkant sokkel til min. 40 cm under terræn.

1.1.3 Sokkelaffugter
4.2 Omfang: 303-001 Sokkelaffugter. Rustfrit stål, 200 mm.

1.1.6 Ydervæg, eksist. murværk
Tilmuring, rulleskifte, udskiftning af mursten, indboret binder, omfugning, facadeåbninger.

1.1.8 Indervæg, eksist. murværk
Indv. opmuring og puds. Indv. puds. Tegloverliggere. Udskiftning af overligger.`,
    },
  ],
};

const STOP = new Set([
  "hvor",
  "hvordan",
  "hvilken",
  "hvilke",
  "hvad",
  "skal",
  "og",
  "den",
  "det",
  "de",
  "til",
  "på",
  "af",
  "en",
  "et",
  "er",
  "som",
  "vi",
  "kan",
  "med",
  "for",
  "om",
  "ikke",
  "jeg",
  "du",
  "har",
  "der",
  "fra",
  "ved",
  "eller",
  "the",
  "and",
]);

function scoreHay(hay: string, words: string[], raw: string[]) {
  const low = hay.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (low.includes(w)) score += w.length >= 5 ? 3 : 1;
    else {
      const st = stemDa(w);
      if (st.length >= 4 && low.includes(st)) score += 2;
    }
  }
  for (const w of raw) {
    if (low.includes(w)) score += 4;
    else {
      const st = stemDa(w);
      if (st.length >= 4 && low.includes(st)) score += 3;
    }
  }
  return score;
}

function windowAround(lines: string[], start: number, max = 560) {
  if (!lines.length) return "";
  const i = Math.max(0, Math.min(start, lines.length - 1));
  const parts: string[] = [lines[i] ?? ""];
  let len = parts[0]!.length;
  if (i > 0) {
    parts.unshift(lines[i - 1]!);
    len += lines[i - 1]!.length;
  }
  for (let k = i + 1; k < lines.length && len < max - 40; k++) {
    parts.push(lines[k]!);
    len += lines[k]!.length;
  }
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function snippetFromCorpus(projectId: string, query: string): { title: string; page: string; excerpt: string; name: string } | null {
  const rows = UDBUD_CORPUS[projectId] ?? [];
  if (!rows.length) return null;
  const raw = query
    .toLowerCase()
    .replace(/[?.,!;:()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  const words = expandQueryWords(raw.length ? raw : query.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (!words.length) return { title: rows[0]!.name, page: "udbud", excerpt: rows[0]!.text.slice(0, 280), name: rows[0]!.name };
  let best: { title: string; page: string; excerpt: string; name: string; score: number } | null = null;
  for (const row of rows) {
    let score = scoreHay(`${row.name} ${row.text}`, words, raw);
    const nameLow = row.name.toLowerCase();
    if (raw.some((w) => /skorsten|tag|skifer|tegltag|renselem/.test(w)) && /ztag|tagarbejde/.test(nameLow)) score += 10;
    if (raw.some((w) => /murer|fuge|puds|gavl|mørtel|sten|afsyr/.test(w)) && /zmur|murer/.test(nameLow)) score += 6;
    if (score <= 0) continue;
    const lines = row.text.split(/\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 24);
    const ranked = lines
      .map((l, i) => {
        let s = scoreHay(l, words, raw);
        if (raw.some((w) => /udkrads|dybt|fuge/.test(w)) && /\d+\s*mm/.test(l)) s += 8;
        if (raw.some((w) => /mørtel|kc/.test(w)) && /kc\s*\d/i.test(l)) s += 6;
        if (raw.some((w) => /skorsten/.test(w)) && /85|15\s*%/.test(l)) s += 8;
        return { i, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.i - b.i);
    const excerpt = windowAround(lines, ranked[0]?.i ?? 0);
    const cand = { title: row.name, page: "udbud", excerpt, name: row.name, score };
    if (!best || cand.score > best.score) best = cand;
  }
  return best;
}

export const ISLEV_UDBUD_FILES = [
  {
    id: "local-islev-mur",
    name: "ISV_K01_C08.2_Zmur - Murer.pdf",
    href: "/udbud/islev/ISV_K01_C08.2_Zmur-Murer.pdf",
  },
  {
    id: "local-islev-tag",
    name: "ISV_K01_C08.2_Ztag - Tagarbejder.pdf",
    href: "/udbud/islev/ISV_K01_C08.2_Ztag-Tagarbejder.pdf",
  },
] as const;
