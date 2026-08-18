// db/database.js
// Supabase-backed data access layer with a safe local JSON fallback.
// This keeps the app running even when the connected Supabase project is
// missing the expected schema or when the service key points to a different DB.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let supabase = null;
try {
  supabase = require('./supabaseClient');
} catch (err) {
  console.warn('[DB] Supabase client unavailable; using local fallback storage.', err.message);
}

const FALLBACK_DB_PATH = path.join(__dirname, 'appointments.json');

function ensureFallbackFile() {
  if (!fs.existsSync(FALLBACK_DB_PATH)) {
    fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify({ appointments: [], nextId: 1 }, null, 2));
  }
}

function readFallbackData() {
  ensureFallbackFile();
  const raw = fs.readFileSync(FALLBACK_DB_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    return { appointments: [], nextId: 1 };
  }
}

function writeFallbackData(data) {
  fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(data, null, 2));
}

function toAppShape(row) {
  if (!row) return null;
  return {
    id: row.id,
    tokenNumber: row.token_number || row.tokenNumber,
    name: row.name,
    mobile: row.mobile,
    email: row.email,
    purpose: row.purpose,
    preferredDate: row.preferred_date || row.preferredDate,
    preferredTime: row.preferred_time || row.preferredTime,
    status: row.status,
    confirmedDate: row.confirmed_date || row.confirmedDate,
    confirmedTime: row.confirmed_time || row.confirmedTime,
    adminNote: row.admin_note || row.adminNote,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

function fromAppShape(item) {
  if (!item) return null;
  return {
    id: item.id,
    token_number: item.tokenNumber,
    name: item.name,
    mobile: item.mobile,
    email: item.email,
    purpose: item.purpose,
    preferred_date: item.preferredDate,
    preferred_time: item.preferredTime,
    status: item.status,
    confirmed_date: item.confirmedDate,
    confirmed_time: item.confirmedTime,
    admin_note: item.adminNote,
    created_at: item.createdAt,
    updated_at: item.updatedAt
  };
}

function generateFallbackToken() {
  const rand = crypto.randomInt(100000, 999999);
  return 'MLA-' + rand;
}

function generateTokenNumber(id) {
  return 'MLA-' + String(id).padStart(6, '0');
}

function createFallbackAppointment({ name, mobile, email = null, purpose, preferredDate = null, preferredTime = null }) {
  const data = readFallbackData();
  const id = data.nextId;
  const appointment = {
    id,
    tokenNumber: generateTokenNumber(id),
    name,
    mobile,
    email,
    purpose,
    preferredDate,
    preferredTime,
    status: 'pending',
    confirmedDate: null,
    confirmedTime: null,
    adminNote: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.appointments.push(appointment);
  data.nextId += 1;
  writeFallbackData(data);
  return appointment;
}

function getFallbackAppointmentsByMobile(mobile) {
  const data = readFallbackData();
  return [...data.appointments]
    .filter((item) => item.mobile === mobile)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getFallbackAllAppointments() {
  const data = readFallbackData();
  return [...data.appointments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getFallbackAppointmentById(id) {
  const data = readFallbackData();
  return data.appointments.find((item) => item.id === Number(id)) || null;
}

function updateFallbackAppointment(id, updates) {
  const data = readFallbackData();
  const idx = data.appointments.findIndex((item) => item.id === Number(id));
  if (idx === -1) return null;
  data.appointments[idx] = {
    ...data.appointments[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  writeFallbackData(data);
  return data.appointments[idx];
}

function deleteFallbackAppointment(id) {
  const data = readFallbackData();
  const idx = data.appointments.findIndex((item) => item.id === Number(id));
  if (idx === -1) return false;
  data.appointments.splice(idx, 1);
  writeFallbackData(data);
  return true;
}

async function createAppointment({ name, mobile, email = null, purpose, preferredDate = null, preferredTime = null }) {
  if (!supabase) {
    return createFallbackAppointment({ name, mobile, email, purpose, preferredDate, preferredTime });
  }

  try {
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
        token_number: generateFallbackToken()
      })
      .select()
      .single();

    if (error) throw error;
    return toAppShape(data);
  } catch (error) {
    console.warn('[DB] Supabase createAppointment failed; falling back to local JSON storage.', error.message || error);
    return createFallbackAppointment({ name, mobile, email, purpose, preferredDate, preferredTime });
  }
}

async function getAllAppointments() {
  if (!supabase) return getFallbackAllAppointments();

  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(toAppShape);
  } catch (error) {
    console.warn('[DB] Supabase getAllAppointments failed; using local JSON storage.', error.message || error);
    return getFallbackAllAppointments();
  }
}

async function getAppointmentsByMobile(mobile) {
  if (!supabase) return getFallbackAppointmentsByMobile(mobile);

  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('mobile', mobile)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(toAppShape);
  } catch (error) {
    console.warn('[DB] Supabase getAppointmentsByMobile failed; using local JSON storage.', error.message || error);
    return getFallbackAppointmentsByMobile(mobile);
  }
}

async function getAppointmentById(id) {
  if (!supabase) return toAppShape(getFallbackAppointmentById(id));

  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return toAppShape(data);
  } catch (error) {
    console.warn('[DB] Supabase getAppointmentById failed; using local JSON storage.', error.message || error);
    return toAppShape(getFallbackAppointmentById(id));
  }
}

async function updateAppointment(id, updates) {
  if (!supabase) return updateFallbackAppointment(id, updates);

  const dbUpdates = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.confirmedDate !== undefined) dbUpdates.confirmed_date = updates.confirmedDate;
  if (updates.confirmedTime !== undefined) dbUpdates.confirmed_time = updates.confirmedTime;
  if (updates.adminNote !== undefined) dbUpdates.admin_note = updates.adminNote;

  try {
    const { data, error } = await supabase
      .from('appointments')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return toAppShape(data);
  } catch (error) {
    console.warn('[DB] Supabase updateAppointment failed; using local JSON storage.', error.message || error);
    const existing = getFallbackAppointmentById(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return updateFallbackAppointment(id, updated);
  }
}

async function deleteAppointment(id) {
  if (!supabase) return deleteFallbackAppointment(id);

  try {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('[DB] Supabase deleteAppointment failed; using local JSON storage.', error.message || error);
    return deleteFallbackAppointment(id);
  }
}

async function logSecurityEvent(entry) {
  if (!supabase) return null;

  try {
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
  } catch (error) {
    console.warn('[DB] Supabase logSecurityEvent failed; skipped.', error.message || error);
    return null;
  }
}

async function getSecurityLogs({ limit = 100, eventType = null } = {}) {
  if (!supabase) return [];

  try {
    let query = supabase.from('security_logs').select('*').order('created_at', { ascending: false }).limit(limit);
    if (eventType) query = query.eq('event_type', eventType);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn('[DB] Supabase getSecurityLogs failed; returning empty list.', error.message || error);
    return [];
  }
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
