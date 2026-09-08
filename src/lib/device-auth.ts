import type { Role } from "./types.ts";

const WHO_KEY = "zenko-who";
const PUSH_USER_KEY = "zenko-push-user";
const OUT_KEY = "zenko-logged-out";
const COOKIE = "zenko_who";

export type DeviceUser = { id: string; role: Role };

function parseWho(raw: string | null | undefined): DeviceUser | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as DeviceUser;
    if (o && typeof o.id === "string" && o.id && (o.role === "mester" || o.role === "svend" || o.role === "laerling")) return o;
  } catch {
    const [id, role] = String(raw).split("|");
    if (id && (role === "mester" || role === "svend" || role === "laerling")) return { id, role };
  }
  return null;
}

function writeCookie(value: string | null) {
  if (typeof document === "undefined") return;
  const expire = `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  if (!value) {
    document.cookie = expire;
    document.cookie = `${COOKIE}=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    return;
  }
  document.cookie = `${COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`));
  if (!hit) return null;
  try {
    return decodeURIComponent(hit.slice(COOKIE.length + 1));
  } catch {
    return hit.slice(COOKIE.length + 1);
  }
}

function setLoggedOut(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.sessionStorage.setItem(OUT_KEY, "1");
    else window.sessionStorage.removeItem(OUT_KEY);
  } catch {
    /* */
  }
}

export function isLoggedOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function readDeviceUser(): DeviceUser | null {
  if (typeof window === "undefined") return null;
  if (isLoggedOut()) return null;
  try {
    const raw = window.localStorage.getItem(WHO_KEY);
    if (raw) return parseWho(raw);
    return null;
  } catch {
    return parseWho(readCookie());
  }
}

export function rememberDeviceUser(user: DeviceUser) {
  const raw = JSON.stringify(user);
  setLoggedOut(false);
  try {
    window.localStorage.setItem(WHO_KEY, raw);
  } catch {
    /* */
  }
  writeCookie(`${user.id}|${user.role}`);
  rememberPushUser(user.id);
}

export function clearDeviceUser() {
  setLoggedOut(true);
  try {
    window.localStorage.removeItem(WHO_KEY);
  } catch {
    /* */
  }
  writeCookie(null);
}

export function rememberPushUser(id: string) {
  try {
    window.localStorage.setItem(PUSH_USER_KEY, id);
  } catch {
    /* */
  }
}

export function readPushUser(): string | null {
  try {
    return window.localStorage.getItem(PUSH_USER_KEY);
  } catch {
    return null;
  }
}

export function pathForRole(role: Role) {
  return role === "mester" ? "/mester" : "/svend";
}

export function performLogout(logout: () => void, goLogin: () => void) {
  clearDeviceUser();
  logout();
  goLogin();
}
