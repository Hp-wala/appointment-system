// db/supabaseClient.js
// Reads keys from environment variables only — never hardcode keys here.
// SUPABASE_SECRET_KEY is the service_role-equivalent key: it can read/write
// everything, bypassing RLS. That's intentional — this client is only ever
// used from the backend (server.js), which already gates admin actions
// behind the ADMIN_PASSWORD check. Never send this key to the browser.

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE key. Copy .env.example to .env and fill in SUPABASE_URL and either SUPABASE_SERVICE_KEY, SUPABASE_SECRET_KEY, or SUPABASE_ANON_KEY.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

module.exports = supabase;
