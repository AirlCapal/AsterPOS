/**
 * Vercel Serverless Function: /api/sync
 * 
 * Provides an on-origin relay endpoint for Aster POS Manager Web Portal & POS Tablet.
 * Bypasses all browser CORS restrictions and proxies requests to the Multi-Branch
 * Google Apps Script Cloud Relay with automatic memory caching fallback.
 */

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxLClbcVO3RN8tKsiyxs_RsKYNbYxQ1FonuyIMxLuu-CBpgwyEOzZDWT21tO9aXUm578w/exec';

// Serverless in-memory cache fallback (persists across warm lambda instances)
const branchMemoryStore = new Map();

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Branch-Id');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL || DEFAULT_SCRIPT_URL;
  const branch = (req.query.branch || req.headers['x-branch-id'] || 'default').toLowerCase().trim();

  // ── GET: Fetch latest branch snapshot ──
  if (req.method === 'GET') {
    const action = req.query.action || 'GET_SYNC_DATA';

    // 1. Ping / Test
    if (action === 'TEST_CONNECTION' || action === 'PING') {
      return res.status(200).json({
        success: true,
        status: 'active',
        service: 'Aster POS Vercel Relay',
        branch,
        timestamp: Date.now(),
        message: `Relay is online for branch [${branch}] ✓`
      });
    }

    // 2. Fetch from Google Apps Script
    try {
      const targetUrl = `${scriptUrl}?action=GET_SYNC_DATA&branch=${encodeURIComponent(branch)}&t=${Date.now()}`;
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.success && data.snapshot) {
          // Update cache
          branchMemoryStore.set(branch, {
            snapshot: data.snapshot,
            source: data.source || 'POS',
            mutationTimestamp: data.mutationTimestamp || Date.now(),
            updatedAt: data.updatedAt || new Date().toISOString()
          });
          return res.status(200).json(data);
        }
      }
    } catch (err) {
      console.warn('[Vercel Relay GET warning]:', err.message);
    }

    // Fallback: Check memory cache
    if (branchMemoryStore.has(branch)) {
      const cached = branchMemoryStore.get(branch);
      return res.status(200).json({
        success: true,
        branch,
        snapshot: cached.snapshot,
        source: cached.source,
        mutationTimestamp: cached.mutationTimestamp,
        updatedAt: cached.updatedAt,
        fromCache: true
      });
    }

    return res.status(200).json({
      success: true,
      branch,
      snapshot: null,
      message: `No snapshot found for branch [${branch}]. Ready for POS sync.`
    });
  }

  // ── POST: Save branch snapshot or send OTP ──
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch {}
      }
      body = body || {};

      const postBranch = (body.branch || branch || 'default').toLowerCase().trim();
      body.branch = postBranch;

      // Update in-memory store immediately
      if (body.action === 'PUSH_SYNC_DATA' || body.action === 'PUSH_WEB_UPDATE') {
        branchMemoryStore.set(postBranch, {
          snapshot: body,
          source: body.source || (body.action === 'PUSH_WEB_UPDATE' ? 'WEB' : 'POS'),
          mutationTimestamp: body.timestamp || Date.now(),
          updatedAt: new Date().toISOString()
        });
      }

      // Forward to Google Apps Script
      try {
        await fetch(`${scriptUrl}?branch=${encodeURIComponent(postBranch)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(body)
        });
      } catch (fwdErr) {
        console.warn('[Vercel Relay POST forward warning]:', fwdErr.message);
      }

      return res.status(200).json({
        success: true,
        branch: postBranch,
        action: body.action,
        timestamp: Date.now(),
        message: `Branch [${postBranch}] synced successfully`
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
