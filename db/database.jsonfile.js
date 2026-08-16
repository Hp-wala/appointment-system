// db/database.js
// Lightweight JSON-file data store. No external database required.
// Good enough for a single-MLA-office appointment system. If you outgrow
// this later (multiple offices, high traffic), swap this file out for a
// real database (PostgreSQL, Supabase, etc.) — the rest of the app only
// talks to the functions exported below, so nothing else has to change.

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'appointments.json');

function ensureFile() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ appointments: [], nextId: 1 }, null, 2));
  }
}

function readData() {
  ensureFile();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { appointments: [], nextId: 1 };
  }
}

function writeData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function generateTokenNumber(id) {
  // Human-friendly token number, e.g. MLA-000042
  return 'MLA-' + String(id).padStart(6, '0');
}

function createAppointment({ name, mobile, email = null, purpose, preferredDate = null, preferredTime = null }) {
  const data = readData();
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
    status: 'pending', // pending | approved | rejected | rescheduled
    confirmedDate: null,
    confirmedTime: null,
    adminNote: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.appointments.push(appointment);
  data.nextId += 1;
  writeData(data);
  return appointment;
}

function getAllAppointments() {
  const data = readData();
  // newest first
  return [...data.appointments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getAppointmentsByMobile(mobile) {
  const data = readData();
  return data.appointments
    .filter((a) => a.mobile === mobile)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getAppointmentById(id) {
  const data = readData();
  return data.appointments.find((a) => a.id === Number(id));
}

function updateAppointment(id, updates) {
  const data = readData();
  const idx = data.appointments.findIndex((a) => a.id === Number(id));
  if (idx === -1) return null;
  data.appointments[idx] = {
    ...data.appointments[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  writeData(data);
  return data.appointments[idx];
}

function deleteAppointment(id) {
  const data = readData();
  const idx = data.appointments.findIndex((a) => a.id === Number(id));
  if (idx === -1) return false;
  data.appointments.splice(idx, 1);
  writeData(data);
  return true;
}

module.exports = {
  createAppointment,
  getAllAppointments,
  getAppointmentsByMobile,
  getAppointmentById,
  updateAppointment,
  deleteAppointment
};
