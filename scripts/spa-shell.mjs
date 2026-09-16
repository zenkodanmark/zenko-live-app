/**
 * GitHub Pages serves 404.html for unknown paths like /r/tf/396.
 * Prerendered HTML is the login route. Strip that snapshot so the client
 * router reads window.location and paints the real page.
 */
export function toSpaShell(html) {
  if (typeof html !== "string" || html.length < 50) return html;
  let out = html;
  if (!/\bdata-spa-shell=/.test(out)) {
    out = out.replace(/<html\b([^>]*)>/i, '<html data-spa-shell="1"$1>');
  }
  out = out.replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, "<!--spa-->");
  if (!out.includes("data-spa-shell-boot")) {
    const boot =
      '<script data-spa-shell-boot="1">(function(){var t=self.$_TSR;if(!t||!t.router||!Array.isArray(t.router.matches))return;t.router.matches=t.router.matches.filter(function(m){return m&&m.i==="__root__";});})();</script>';
    if (/<script type="module"/.test(out)) {
      out = out.replace(/<script type="module"/, `${boot}<script type="module"`);
    } else {
      out = out.replace(/<\/body>/i, `${boot}</body>`);
    }
  }
  return out;
}

export function isSpaShell(html) {
  if (typeof html !== "string") return false;
  if (!html.includes("data-spa-shell")) return false;
  if (!html.includes("/assets/")) return false;
  if (/login-emp-ole/.test(html)) return false;
  if (/<main\b[^>]*>[\s\S]*Mød ind på pladsen[\s\S]*<\/main>/i.test(html)) return false;
  return true;
}
