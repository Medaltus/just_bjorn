// api/sheet-config.js
//
// Serves this deployment's Google Sheet fileId/gid map to the frontend as
// JSON, read from the SHEET_CONFIG Vercel env var. The frontend's bootstrap
// script (top of index.html <head>) fetches this synchronously before any
// other script runs, and every sheet-consuming const in index.html reads
// window.SHEET_CFG.<KEY>.fileId / .gid.
//
// This is a best-effort implementation, NOT a copy of Skinuva's actual
// api/sheet-config.js — I (Claude) don't have that file to copy from
// directly, only the general pattern description from prior conversation
// history ("a SHEET_CONFIG env var (JSON blob with fileId/gid per sheet
// key), read via window.SHEET_CFG"). If Skinuva/Cosmette's real
// implementation differs (auth handling, caching, response shape), prefer
// that one for consistency across brand dashboards and port this file to
// match it rather than the other way around.
//
// Expected SHEET_CONFIG env var shape (set in Vercel project settings for
// this deployment only — one JSON object, flat, one entry per key):
//
//   {
//     "SHEET_ORDERS": { "fileId": "1SiYu8e2-...", "gid": "1781575614" },
//     "SHEET_ADVERTISING": { "fileId": "13cN301Q...", "gid": "832045207" },
//     ...
//   }
//
// Keys with no real value yet (SHEET_LISTING_AUDIT, SHEET_INSIGHTS,
// SHEET_COMPETITOR, SHEET_AMAZON_REVIEWS, SHEET_BRAND_ANALYTICS,
// SHEET_WALMART_SEARCH_TERMS, SHEET_RETURNS, SHEET_WALMART_RETURNS,
// SHEET_REPORT_INSIGHTS, SHEET_EVENT_REPORT_INSIGHTS — see the build notes
// at the top of index.html) can be omitted or set to
// { "fileId": "", "gid": "" }; the frontend already treats a blank fileId
// as "nothing to fetch yet" and shows an empty/pending state rather than
// erroring.

module.exports = async function handler(req, res) {
  // Read-only config endpoint — no method other than GET makes sense here.
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = process.env.SHEET_CONFIG;
  if (!raw) {
    console.error('[sheet-config] SHEET_CONFIG env var is not set for this deployment.');
    // Return an empty object rather than a hard error — the frontend's
    // bootstrap script already treats a missing/failed config fetch as
    // "show empty states everywhere" rather than a fatal error, so this
    // degrades gracefully rather than breaking the whole dashboard.
    return res.status(200).json({});
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('[sheet-config] SHEET_CONFIG env var is not valid JSON:', e.message);
    return res.status(200).json({});
  }

  // Small shape guard — every value should be an object with fileId/gid
  // strings (even if blank), so a typo in the env var JSON fails loudly in
  // logs rather than silently producing confusing frontend errors later.
  for (const [key, val] of Object.entries(parsed)) {
    if (typeof val !== 'object' || val === null || !('fileId' in val) || !('gid' in val)) {
      console.warn(`[sheet-config] SHEET_CONFIG key "${key}" is missing fileId/gid — expected { fileId, gid }, got:`, val);
    }
  }

  // Cache briefly at the edge/CDN layer — this changes only when Jaclyn
  // updates the env var (which requires a redeploy anyway), so a short
  // cache is safe and avoids hitting this function on every page load.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  return res.status(200).json(parsed);
};
