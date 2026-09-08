const GROUPS: string[][] = [
  ["hulmur", "hulmursisolering", "isolering", "stenuld", "granulat", "lambda", "λd", "indblæs"],
  ["tegl", "teglsten", "maskinsten", "byggesten", "mursten", "facadesten"],
  ["mørtel", "kkh", "kalkmørtel", "hydraulisk", "fugemørtel"],
  ["stillads", "haki", "overdækning", "fodplader", "ladetårn"],
  ["omfugning", "udfræsning", "udkradsning", "udkradses", "fuge", "fuger", "fugning", "skrabefuge"],
  ["bindere", "binder", "renoveringsbindere", "bølgeanker"],
  ["sålbænk", "saalbænk", "karm"],
  ["altan", "vange", "fils", "filsning", "filts", "puds", "vandskuring", "gavl", "gavle"],
  ["skorsten", "skorstenene", "udkasning", "renselem", "tagkrone", "betonkrone"],
  ["skifer", "tegltag", "tagfod", "forskelling"],
  ["kc", "50/50/700", "50/50/490", "fortvej"],
  ["afsyring", "afsyre", "afsyres"],
];

export function stemDa(w: string) {
  const s = w.toLowerCase();
  const cut = s.replace(/(enes|erne|ens|ene|ings|ing|ede|ende|es|er|et)$/i, "");
  return cut.length >= 4 ? cut : s;
}

export function expandQueryWords(words: string[]): string[] {
  const out = new Set(words.map((w) => w.toLowerCase()));
  for (const w of [...out]) {
    const stem = stemDa(w);
    if (stem.length >= 5) out.add(stem);
    for (const g of GROUPS) {
      if (g.some((x) => w.includes(x) || x.includes(w) || (stem.length >= 5 && (x.includes(stem) || stem.includes(x))))) {
        for (const x of g) out.add(x);
      }
    }
  }
  return [...out];
}
