import { fileHref } from "./plads-file";

export type DriveSlot = "root" | "udbud" | "ks" | "kunde" | "extra" | "ue" | "reports" | "meetings" | "tf" | "ent" | "inbox" | "chat";
export type DriveMap = Record<DriveSlot, string>;

export const SAGER_ROOT_ID = "1SmsIK5dTG2Kvpj0mjlQnr1TBfr9HgdwJ";
export const INBOX_FOLDER_NAME = "06 Felt-indbakke";
export const CHAT_FOLDER_NAME = "07 Chat";
export const TODO_FOLDER_NAME = "06 To-do";
export const BESKEDER_FOLDER_NAME = "07 Beskeder";
export const ORDERS_FOLDER_NAME = "09 Bestillinger";
export const RECEIPTS_FOLDER_NAME = "10 Modtagelser";
export const PLADS_FOLDER_NAME = "11 Pladsfiler";
export const AS_FOLDER_NAME = "02 Ekstra arbejde";
export const ER_FOLDER_NAME = "03 Entreprenør rapporter";
export const KS_REPORTS_FOLDER_NAME = "05 Rapporter";
export const ERFARING_FOLDER_NAME = "12 Erfaring";
export const DAGSRAPPORT_FOLDER_NAME = "13 Dagsrapport";

export function todoDriveFolder(todoId: string) {
  return `${TODO_FOLDER_NAME}/${todoId}`;
}

export function chatDriveFolder(_threadId?: string) {
  return CHAT_FOLDER_NAME;
}

export const DRIVE: Record<string, DriveMap> = {
  "job-hillerodsholm": {
    root: "1pysawCl1u-G3fxJnpUyjd_EDdcnMGHZ6",
    udbud: "1sY1Zxbb0KN9tWZITKun_JQ3Kom9LDSc_",
    ks: "1vgtPoCRMstznbEYed73dY-mRVdjN3qWY",
    kunde: "179ReK22q6j7Gmk8HEw3ExULwWDdaSLp-",
    extra: "1APZRLYMNm3E2b7Wy5nwq5xgnEdIiBE7S",
    ue: "1_tDpsVthNWLhI82RbRdbR_PSIjksN95n",
    reports: "14_ApOilZCkYwmrcX7sgJtRMtsjVcBw-v",
    meetings: "1iXmBMvnv2EEberWlObV7ssiMvS_K960u",
    tf: "1XtjLKxMcdvg5GqmZl31I63vbK1ew6crR",
    ent: "1lDmE-UOBU5Pok8eZ-pENpIP-vKxU2PCG",
    inbox: "1_BVtnd3XqBHvnpxPrH7dg5L-Fu9b2mpC",
    chat: "13dag86nZeyHQI5PepCg68HaxkR97wQ9d",
  },
  "job-islevvaenge": {
    root: "1q8ATaOkfcHZtD4ayPY5my9PheXFyie7Q",
    udbud: "1jrKrS6Q0T7Sa1cfbr-wYDejr-r2KGsBx",
    ks: "10Vnwq2pDEBgEiEsnDieE4vIFaghCwTz2",
    kunde: "19Yd7WqLa7Ii-LQnKUCLTuheQ_2MODxyx",
    extra: "1YcH-DTJfAv6XZFYTVSIeBBIUr-yUQ04n",
    ue: "1Y-26uEAWZ1HYeOsYCOcDNZAhcJmg7OhY",
    reports: "1udiFw9DKFmEftFEBfMR2IvSqX-AtnVal",
    meetings: "1SAfjLVNmuTmvrJQVS3VtIpaa5hxXK_Ya",
    tf: "1DZ0q5_gZKrIRWBmKHTYd9ejXmxAuOJHF",
    ent: "14p61-InUfuxKp4N18p8L4dlUWXhsoegk",
    inbox: "1d3VeZNWNV67P2BFkKdmgnAJRMX2IRFPg",
    chat: "1tzVIUaYpILRv2Po9hTb-OItopRwbgXCX",
  },
  "job-kaerhuset": {
    root: "17mLpUcnn3SqE2E_NT_yImBH9fx2_aELo",
    udbud: "1b4TUbmrrOr7xc8EuYHhZrsYYNUUVJPm4",
    ks: "1n9YCLyVBJdk-Yx_6co1vOKITGHjQRNf9",
    kunde: "1ZSiDr5pn3A-wJiDUlWe6sRgbybmLm9BV",
    extra: "1FzJgcYorpHdtH_4KwoQH59H2MUDzqT6h",
    ue: "1TSN8s-KqaSShNQVKxPnR1wJf4tIeamSn",
    reports: "1JcqxWY4UXGOL1wnZe0rG1FiIa9xYziS5",
    meetings: "1H3bcstYGM9lfPBnGTUowW3RIWWMB6jKO",
    tf: "18fxsrupx8YX0G-Rdm5F0kLfD12_OBqng",
    ent: "1BamcrbE9eLiTc3uGD8A4C1ks6lwYAuM6",
    inbox: "1bh0OKEOgnfHC_s-tgX9ndwqmP6iAuQmq",
    chat: "1NUeIJz6kAqrXKZh4iuy9aCqZXwu2MyKk",
  },
  "job-solbakkegaard": {
    root: "1N13ANBiIOjGYDDJrPhsJcLoGdVg0xbLp",
    udbud: "12PaFXLv0PE-Tk4Mp20eGhwNQseQuo8Sx",
    ks: "1sQH3p9R_BPRV5E08eOeqoW1Hiqx20YAi",
    kunde: "1ExkZu4UKR-8xMNWvToFMEb-z2skkVsFj",
    extra: "1qOMul3NZhW6utaFr9BoTWwCsZVoyWPRW",
    ue: "1F4kAJ2SiXwSvZaqR1EAmi5d3yvuwscEy",
    reports: "1aYzbzWturwbRSBWtvgcoAt9SFGShZIp5",
    meetings: "1t_eqjpVRPvas80uo_qznH43h5u0LcDSJ",
    tf: "1_j1XtfkW0Tr7Z0iF39kn-PZ1k-YCxsR8",
    ent: "1BLeFPdst-7rPS-MHm6eeyHSKiwUJcJ53",
    inbox: "1uXbIe3dCsB23sMaq9iKRdQD5KeODokG1",
    chat: "1jDp8kTSNiVJ6J2t_eXNgVw1EBDta_Inc",
  },
  "job-skole": {
    root: "1DUjLReMD8oFjZuz-yDJ9ICyWNhsnXg6E",
    udbud: "10ZI4-PFoenKHU0ezBbCrAauAkgCHxilI",
    ks: "1t5HsCdabrShIrRhYsMqNb5zLOP0PooWS",
    kunde: "1cCSBdHeY_JCtgifea89Gdw3W3vzqEIH2",
    extra: "1kiKL54J54dl-WAGRURKrXWQlg0yBANA1",
    ue: "1CfrEwkmxszlb0osSgJXA58ihmqwJzsAL",
    reports: "1qw1uHvYp1HZQraAS_OEdY24vyLGIBTCV",
    meetings: "1cmhkr7o0jp_sHprDEhBi9ZQ7IL2Tfzs1",
    tf: "1PBWVnAwSU8bCqTO-tOsdIMzBwpw-ROfo",
    ent: "1bxMc8VNV7g3f062L-28ww4KK9qkH04mg",
    inbox: "1QOHLnpA27zmep3zTYMCKuWcZ1APS0xRi",
    chat: "1YQx_-tNaImu2msBDv2Tvw0tuy9w6BCfc",
  },
  "job-soren-privat": {
    root: "1U4Qnvln7aSI1rgb1ZPxPFo_xJkrpTrQN",
    udbud: "1rSzZ5M_Gma3PUgE0Hf2Nr8LtSxBdFkl_",
    ks: "1rrSg3YgVgzWf9nblOSrRxhBAVi5KBSif",
    kunde: "1TD_NuCs6gcGyrGx0TUkAyxpBd3zuS1In",
    extra: "1070Iftrp-7lgRsKo0T7daTiaKa539Z40",
    ue: "1rP4Kxfk-XCXI4u_ySs-gbOlfjZsZn7P1",
    reports: "18MIrMB9eGLHPOwBYg_jxepkrwJTXRFJ2",
    meetings: "1bHYBZakKaEnz2pILnzDdMmIStr5J-KfZ",
    tf: "1g1LyomV1GsAOu_lNCbLL5OPx6V0YmuNO",
    ent: "1-UdK9Stcd6z3smPrd3aGQGSByTHePGq4",
    inbox: "1kk9_TnFlcYAMLgGf4LQOhwobMybD6GOR",
    chat: "1jLZVXxkmkOMMXCcLOyy__sdn4fVoOIZR",
  },
  "job-klostergaarden": {
    root: "1XOpKplKVuphOfBNwyluc_l88E4Rw1ATj",
    udbud: "1jzE96Pk4T3POs2i7_LtU-LXMclKx5NMX",
    ks: "1U73gm9lpluPIv9k4aO7cF4u79QHqHWI-",
    kunde: "18mGIG0o4u1pSGuLB2431V7vi24ql04aL",
    extra: "1bKIKSZ0GMdQFqzWqM_cF0GEoU_8Yft8G",
    ue: "1dS6LDZGCDmFGPAajiaE6pG7IenzUyBXJ",
    reports: "1wYMXN-pEWS_K3M9dZmjRjwu-5qBCbVz5",
    meetings: "1NKmwc7kmbgDXefEh3yMv4YZ9zZRGxbjB",
    tf: "142thFRxAAMwLl23I7B4WauU02sgQ1I4K",
    ent: "1Kecrjph5goxHx6YYUFQbpdGlx9ylG3Vu",
    inbox: "1bn0FVYPjepKCGBk1AaIyAil5Byjxplxh",
    chat: "1uERj5yXTpfiSrNWNNunHP0_bX8_Zdtl6",
  },
  "job-provestenen": {
    root: "1c2O_ygXqDyMbKZRbQ_pVi_UFVpxmXF1q",
    udbud: "14L-6haGCy5Yg6mB_00dsfX5KvRj52k66",
    ks: "1hNgDZX3R0jrZVIZ3no-57TUDFA0qLLoU",
    kunde: "1WPPI6cu0Jl_YBmNuyavFB9nWYMVgCpOc",
    extra: "1_hSACqIsAfDvevspNWrLFTivj6YYMbep",
    ue: "1W3q9I45lXjIUOBkm7Lk9OyyNwTMxGDPH",
    reports: "1M_lSYIm3tF-Np0WJSL4cnO7wzizAey1g",
    meetings: "1q_pKj2SKow4pUM3JR5zDYhFJOTL4lrwY",
    tf: "1inBg_d-GlAZtyXppFFwh11JvPIPi9KQT",
    ent: "1RXhO1OWSUD6Dz6e6N5uIBX4HURua5HDQ",
    inbox: "1P0rGVH_zWVFgTO-z2mX3ZmdVzJivSCtS",
    chat: "1LltggGKzmyr6GjBpTfj8BFbLYZ52bKqX",
  },
};

export const CLASS_TO_SLOT: Record<"todo" | "materials" | "extra" | "tf" | "ent" | "ks", DriveSlot> = {
  todo: "chat",
  materials: "extra",
  extra: "extra",
  tf: "tf",
  ent: "ent",
  ks: "ks",
};

export const LIN_TF_FOLDER_NAME = "LIN TF rapporter";

export const MASTER_SLOTS: { slot: DriveSlot; label: string }[] = [
  { slot: "udbud", label: "01 Udbudsmateriale" },
  { slot: "ks", label: "02 KS" },
  { slot: "kunde", label: "03 Kunde" },
  { slot: "extra", label: "02 Ekstra arbejde" },
  { slot: "ue", label: "04 UE" },
  { slot: "reports", label: "05 Rapporter" },
  { slot: "meetings", label: "01 Byggemøder" },
  { slot: "tf", label: LIN_TF_FOLDER_NAME },
  { slot: "ent", label: "03 Entreprenør rapporter" },
  { slot: "inbox", label: INBOX_FOLDER_NAME },
  { slot: "chat", label: CHAT_FOLDER_NAME },
];

export type DriveFallbackFile = { id: string; name: string; folder?: boolean; href?: string };

export const DRIVE_FALLBACK: Record<string, DriveFallbackFile[]> = {};

const EXTRA_DRIVE: Record<string, DriveMap> = {};

export function rememberDrive(projectId: string, map: DriveMap) {
  EXTRA_DRIVE[projectId] = map;
}

function mergeMaps(base: DriveMap, extra: DriveMap): DriveMap {
  const out = { ...base };
  (Object.keys(extra) as DriveSlot[]).forEach((k) => {
    if (extra[k]) out[k] = extra[k];
  });
  return out;
}

export function driveFor(projectId: string): DriveMap | null {
  const base = DRIVE[projectId];
  const extra = EXTRA_DRIVE[projectId];
  if (!base && !extra) return null;
  if (!extra) return base ?? null;
  if (!base) return extra;
  return mergeMaps(base, extra);
}

export function driveMapIncomplete(map: DriveMap | null | undefined) {
  if (!map?.root) return true;
  return !map.udbud || !map.reports || !map.chat;
}

export function driveFolderUrl(_folderId: string) {
  return "";
}

export function driveFileUrl(fileId: string) {
  return fileHref(fileId);
}

export function slotFolderId(projectId: string, slot: DriveSlot) {
  return driveFor(projectId)?.[slot] ?? "";
}
