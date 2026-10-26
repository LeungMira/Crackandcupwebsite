/**
 * CRACK & CUP — RUNTIME ENVIRONMENT CONFIG
 * - On Cloudflare Pages: Leave empty! `/api/menu` and `/api/submit-order` automatically use
 *   Cloudflare Environment Variables (`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`).
 * - On GitHub Pages / GitHub Actions: Automatically injected during deployment from
 *   GitHub Repository Secrets / Variables (`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`).
 */
window.__CNC_CONFIG__ = window.__CNC_CONFIG__ || {
  SUPABASE_URL: '',
  SUPABASE_PUBLISHABLE_KEY: ''
};
