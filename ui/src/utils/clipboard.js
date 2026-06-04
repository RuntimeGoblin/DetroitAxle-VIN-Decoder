/**
 * Copy text to clipboard.
 *
 * Tries the modern Clipboard API first (requires HTTPS / localhost).
 * Falls back to the legacy execCommand approach so it works over plain HTTP
 * (internal LAN deployments, dev servers without TLS, etc.).
 */
export async function copyText(text) {
  // Modern path — available on HTTPS or localhost
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Secure context check failed — fall through to execCommand
    }
  }

  // Legacy fallback — works on HTTP
  const el = document.createElement("textarea");
  el.value = text;
  el.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none";
  document.body.appendChild(el);
  el.focus();
  el.select();
  try {
    if (!document.execCommand("copy")) throw new Error("execCommand failed");
  } finally {
    document.body.removeChild(el);
  }
}
