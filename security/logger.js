const geoip = require('geoip-lite');
let supabaseDb = null;
try {
  supabaseDb = require('../db/database');
} catch (err) {
  supabaseDb = null;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || null;
}

function sanitizeDetails(details) {
  if (!details || typeof details !== 'object') return details;
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [key, typeof value === 'string' ? value : value])
  );
}

async function logSecurityEvent({ eventType, req, details = null }) {
  try {
    const ip = getClientIp(req);
    const geo = ip ? geoip.lookup(ip) : null;
    const entry = {
      timestamp: new Date().toISOString(),
      eventType,
      ipAddress: ip,
      latitude: geo?.ll?.[0] ?? null,
      longitude: geo?.ll?.[1] ?? null,
      city: geo?.city ?? null,
      region: geo?.region ?? null,
      country: geo?.country ?? null,
      userAgent: req.headers['user-agent'] || null,
      requestPath: req.originalUrl || req.url || null,
      details: sanitizeDetails(details)
    };

    if (supabaseDb && typeof supabaseDb.logSecurityEvent === 'function') {
      try {
        await supabaseDb.logSecurityEvent(entry);
      } catch (dbErr) {
        console.error('Failed to write security log to database:', dbErr);
      }
    } else {
      console.warn('Security log write skipped because Supabase logger is unavailable.');
    }
  } catch (err) {
    console.error('Failed to log security event:', err);
  }
}

async function readSecurityLogs({ limit = 100, eventType = null } = {}) {
  if (supabaseDb && typeof supabaseDb.getSecurityLogs === 'function') {
    try {
      return await supabaseDb.getSecurityLogs({ limit, eventType });
    } catch (err) {
      console.warn('Supabase security logs unavailable; returning empty array.', err.message);
      return [];
    }
  }
  console.warn('Security log read skipped because Supabase logger is unavailable.');
  return [];
}

module.exports = { logSecurityEvent, readSecurityLogs };