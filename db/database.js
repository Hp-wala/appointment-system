// db/database.js
// Supabase-backed data access layer. Same function names/shapes as the
// original JSON-file version (db/database.jsonfile.js) — server.js doesn't
// need to change no matter which one you use.
//
// Requires supabase/schema.sql to have been run in your Supabase project's
// SQL Editor first (creates the `appointments` table, the token-number
// trigger, and the RLS policies).

const supabase = require('./supabaseClient');
const crypto = require('crypto');

// Convert DB row (snake_case) -> app shape (camelCase), matching what the
// frontend already expects.
function toAppShape(row) {
  if (!row) return null;
  return {
    id: row.id,
    tokenNumber: row.token_number,
    name: row.name,
    mobile: row.mobile,
    email: row.email,
    purpose: row.purpose,
    preferredDate: row.preferred_date,
    preferredTime: row.preferred_time,
    status: row.status,
    confirmedDate: row.confirmed_date,
    confirmedTime: row.confirmed_time,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Generate a unique token number in app code.
// The DB trigger (generate_appointment_token) will override this with a
// sequential MLA-000001 format IF the trigger is set up correctly.
// This fallback ensures inserts never fail due to NOT NULL on token_number.
function generateFallbackToken() {
  const rand = crypto.randomInt(100000, 999999);
  return 'MLA-' + rand;
}

async function createAppointment({ name, mobile, email = null, purpose, preferredDate = null, preferredTime = null }) {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      name,
      mobile,
      email,
      purpose,
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      status: 'pending',
      token_number: generateFallbackToken() // DB trigger will override with sequential ID if set up
    })
    .select()
    .single();

  if (error) {
    console.error('[DB] createAppointment error:', JSON.stringify(error));
    throw error;
  }
  return toAppShape(data);
}


async function getAllAppointments() {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(toAppShape);
}

async function getAppointmentsByMobile(mobile) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('mobile', mobile)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(toAppShape);
}

async function getAppointmentById(id) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return toAppShape(data);
}

async function updateAppointment(id, updates) {
  const dbUpdates = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.confirmedDate !== undefined) dbUpdates.confirmed_date = updates.confirmedDate;
  if (updates.confirmedTime !== undefined) dbUpdates.confirmed_time = updates.confirmedTime;
  if (updates.adminNote !== undefined) dbUpdates.admin_note = updates.adminNote;

  const { data, error } = await supabase
    .from('appointments')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return toAppShape(data);
}

async function deleteAppointment(id) {
  const { error } = await supabase.from('appointments').delete().eq('id', id);
  if (error) throw error;
  return true;
}

async function logSecurityEvent(entry) {
  const { data, error } = await supabase.from('security_logs').insert({
    event_type: entry.eventType,
    ip_address: entry.ipAddress,
    latitude: entry.latitude,
    longitude: entry.longitude,
    city: entry.city,
    region: entry.region,
    country: entry.country,
    user_agent: entry.userAgent,
    request_path: entry.requestPath,
    details: entry.details
  });
  if (error) throw error;
  return data;
}

async function getSecurityLogs({ limit = 100, eventType = null } = {}) {
  let query = supabase.from('security_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (eventType) query = query.eq('event_type', eventType);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

module.exports = {
  createAppointment,
  getAllAppointments,
  getAppointmentsByMobile,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  logSecurityEvent,
  getSecurityLogs
};
