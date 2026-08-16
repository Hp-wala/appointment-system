// server.js
// MLA Appointment Management Website — backend API + static file server.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const db = require('./db/database');
let supabaseDb = null;
try {
  supabaseDb = require('./db/database');
} catch (err) {
  console.warn('Supabase client not available for security logs:', err.message);
}
const { sendContactMessage } = require('./mailer');
const { logSecurityEvent, readSecurityLogs } = require('./security/logger');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_COOKIE_NAME = 'mla_admin_session';
const sessions = new Map();

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || 'changeme123';
}

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:3000'];

if (!process.env.ALLOWED_ORIGINS) {
  console.warn('WARNING: ALLOWED_ORIGINS is not configured. Defaulting to localhost only. Set ALLOWED_ORIGINS in production.');
}

const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://translate.google.com', 'https://translate.googleapis.com', 'https://translate-pa.googleapis.com', "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcElem: ["'self'", 'https://translate.google.com', 'https://translate.googleapis.com', 'https://translate-pa.googleapis.com', "'unsafe-inline'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', 'https://translate.googleapis.com', 'https://translate-pa.googleapis.com', 'https://www.gstatic.com', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://www.google.com', 'https://www.gstatic.com', 'https://translate.googleapis.com', 'https://translate.google.com', 'https://translate-pa.googleapis.com'],
      connectSrc: ["'self'", 'https://translate.google.com', 'https://translate.googleapis.com', 'https://translate-pa.googleapis.com', 'https://www.gstatic.com'],
      frameSrc: ["'self'", 'https://translate.googleapis.com', 'https://translate.google.com', 'https://translate-pa.googleapis.com'],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"]
    }
  }
};


const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent({ eventType: 'rate_limit_exceeded', req, details: { limiter: 'general_api' } }).catch(() => {});
    res.status(429).json({ error: 'Too many requests. Please wait a few minutes and try again.' });
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent({ eventType: 'rate_limit_exceeded', req, details: { limiter: 'admin_login' } }).catch(() => {});
    res.status(429).json({ error: 'Too many login attempts. Please wait 15 minutes and try again.' });
  }
});

const publicSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent({ eventType: 'rate_limit_exceeded', req, details: { limiter: 'public_submission' } }).catch(() => {});
    res.status(429).json({ error: 'Too many submissions from this IP. Please wait an hour and try again.' });
  }
});

function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const cookies = header.split(';').map((cookie) => cookie.trim().split('='));
  const found = cookies.find(([key]) => key === name);
  return found ? decodeURIComponent(found[1]) : null;
}

function setAdminCookie(res, token) {
  const cookie = `${ADMIN_COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookie);
}

function clearAdminCookie(res) {
  const cookie = `${ADMIN_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookie);
}

function getAdminToken(req) {
  let token = getCookie(req, ADMIN_COOKIE_NAME);
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  if (!token) {
    token = req.headers['x-admin-token'];
  }
  return token;
}

function requireAdmin(req, res, next) {
  const token = getAdminToken(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
}


function stripHtml(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/<[^>]*>/g, '').trim();
}

const appointmentValidation = [
  body('name')
    .trim()
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters.'),
  body('mobile')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Mobile must be exactly 10 digits.'),
  body('purpose')
    .trim()
    .isString()
    .isLength({ min: 5, max: 500 })
    .withMessage('Purpose must be 5-500 characters.'),
  body('preferredDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Preferred date must be a valid ISO date.')
    .custom((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date >= today;
    })
    .withMessage('Preferred date cannot be in the past.'),
  body('preferredTime')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Preferred time must be in HH:MM format.'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Enter a valid email address.')
    .normalizeEmail(),
  handleValidationErrors
];

const contactValidation = [
  body('name')
    .trim()
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Enter a valid email address.')
    .normalizeEmail(),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone must be 10 digits if provided.'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Message must be 10-2000 characters.'),
  handleValidationErrors
];

const statusValidation = [
  body('mobile')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Mobile must be exactly 10 digits.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Enter a valid email address.'),
  handleValidationErrors
];

const appointmentActionValidation = [
  param('id')
    .isInt()
    .withMessage('Appointment ID must be a valid integer.'),
  body('action')
    .trim()
    .isIn(['approve', 'reject', 'reschedule'])
    .withMessage('Action must be approve, reject, or reschedule.'),
  body('confirmedDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Confirmed date must be a valid ISO date.'),
  body('confirmedTime')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Confirmed time must be in HH:MM format.'),
  body('adminNote')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Admin note must be 1000 characters or less.'),
  handleValidationErrors
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const errorDetails = errors.array().map((err) => ({ field: err.param, message: err.msg }));
  if (errorDetails.length >= 2) {
    logSecurityEvent({ eventType: 'invalid_input_attempt', req, details: { errors: errorDetails } }).catch(() => {});
  }

  return res.status(400).json({ error: 'Invalid input.', details: errorDetails });
}

app.use(helmet(helmetOptions));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  }
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', generalApiLimiter);

// ---------- Simple admin auth ----------
// Not bank-grade security — just enough to keep the dashboard away from
// random visitors. Good starting point for a college/office project;
// swap in real auth (sessions, JWT, Supabase Auth, etc.) before going live
// with sensitive citizen data.

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (password === getAdminPassword()) {
    const token = crypto.randomBytes(16).toString('hex');
    sessions.set(token, { createdAt: Date.now() });
    setAdminCookie(res, token);
    logSecurityEvent({ eventType: 'admin_login_success', req, details: { path: '/api/admin/login' } }).catch(() => {});
    return res.json({ success: true, token });
  }
  logSecurityEvent({ eventType: 'failed_admin_login', req, details: { path: '/api/admin/login' } }).catch(() => {});
  return res.status(401).json({ success: false, error: 'Incorrect password.' });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = getAdminToken(req);
  if (token) {
    sessions.delete(token);
  }
  clearAdminCookie(res);
  res.json({ success: true });
});

app.get('/api/admin/validate', (req, res) => {
  const token = getAdminToken(req);
  if (token && sessions.has(token)) {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, error: 'Unauthorized' });
});

app.post('/api/admin/change-password', requireAdmin, [
  body('currentPassword').trim().isLength({ min: 1 }).withMessage('Current password is required.'),
  body('newPassword').trim().isLength({ min: 8 }).withMessage('New password must be at least 8 characters long.'),
  body('confirmPassword').trim().custom((value, { req }) => value === req.body.newPassword).withMessage('Passwords do not match.'),
  handleValidationErrors
], async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (currentPassword !== getAdminPassword()) {
    return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
  }
  process.env.ADMIN_PASSWORD = newPassword;
  logSecurityEvent({ eventType: 'admin_password_changed', req, details: { path: '/api/admin/change-password' } }).catch(() => {});
  return res.json({ success: true });
});

app.post('/api/admin/reset-password', [
  body('resetCode').trim().isLength({ min: 1 }).withMessage('Reset code is required.'),
  body('newPassword').trim().isLength({ min: 8 }).withMessage('New password must be at least 8 characters long.'),
  body('confirmPassword').trim().custom((value, { req }) => value === req.body.newPassword).withMessage('Passwords do not match.'),
  handleValidationErrors
], async (req, res) => {
  const { resetCode, newPassword } = req.body;
  if (resetCode !== process.env.ADMIN_RESET_CODE) {
    return res.status(401).json({ success: false, error: 'Invalid reset code.' });
  }
  process.env.ADMIN_PASSWORD = newPassword;
  logSecurityEvent({ eventType: 'admin_password_reset', req, details: { path: '/api/admin/reset-password' } }).catch(() => {});
  return res.json({ success: true });
});

// ---------- Citizen-facing routes ----------

// Create a new appointment request
app.post('/api/appointments', publicSubmissionLimiter, appointmentValidation, async (req, res) => {
  try {
    const { name, mobile, email, purpose, preferredDate, preferredTime } = req.body;
    const appointment = await db.createAppointment({
      name: stripHtml(name),
      mobile: stripHtml(mobile),
      email: email ? stripHtml(email) : null,
      purpose: stripHtml(purpose),
      preferredDate: preferredDate ? stripHtml(preferredDate) : null,
      preferredTime: preferredTime ? stripHtml(preferredTime) : null
    });
    res.status(201).json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create appointment. Please try again.' });
  }
});

// Citizen checks status of their own requests by mobile + email
app.post('/api/appointments/status', statusValidation, async (req, res) => {
  try {
    const { mobile, email } = req.body;
    const appointments = await db.getAppointmentsByMobile(stripHtml(mobile));
    const matched = appointments.filter((appt) => {
      if (!appt.email) {
        return false;
      }
      return appt.email.trim().toLowerCase() === stripHtml(email).trim().toLowerCase();
    });

    res.json(matched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch status. Please try again.' });
  }
});

// ---------- Admin-facing routes ----------

// List all appointments (list + calendar view both use this)
app.get('/api/appointments', requireAdmin, async (req, res) => {
  try {
    res.json(await db.getAllAppointments());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch appointments.' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptimeSeconds: process.uptime() });
});

app.get('/api/admin/security-logs', requireAdmin, async (req, res) => {
  try {
    const eventType = req.query.eventType || null;
    const limit = Number(req.query.limit) || 100;
    let logs = [];

    if (supabaseDb && typeof supabaseDb.getSecurityLogs === 'function') {
      try {
        logs = await supabaseDb.getSecurityLogs({ limit, eventType });
      } catch (err) {
        console.warn('Supabase security logs unavailable; falling back to local logs.', err.message);
        logs = await readSecurityLogs({ limit, eventType });
      }
    } else {
      logs = await readSecurityLogs({ limit, eventType });
    }

    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch security logs.' });
  }
});

// Approve / Reject / Reschedule a request
app.patch('/api/appointments/:id', requireAdmin, appointmentActionValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, confirmedDate, confirmedTime, adminNote } = req.body;

    const existing = await db.getAppointmentById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    let updates = { adminNote: adminNote ? stripHtml(adminNote) : existing.adminNote };

    if (action === 'approve') {
      updates.status = 'approved';
      updates.confirmedDate = confirmedDate || existing.preferredDate;
      updates.confirmedTime = confirmedTime || existing.preferredTime;
    } else if (action === 'reject') {
      updates.status = 'rejected';
      updates.confirmedDate = null;
      updates.confirmedTime = null;
    } else if (action === 'reschedule') {
      if (!confirmedDate || !confirmedTime) {
        return res.status(400).json({ error: 'confirmedDate and confirmedTime are required to reschedule.' });
      }
      updates.status = 'rescheduled';
      updates.confirmedDate = confirmedDate;
      updates.confirmedTime = confirmedTime;
    } else {
      return res.status(400).json({ error: 'action must be approve, reject, or reschedule.' });
    }

    const updated = await db.updateAppointment(id, updates);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update appointment. Please try again.' });
  }
});

app.delete('/api/appointments/:id', requireAdmin, param('id').isInt().withMessage('Appointment ID must be a valid integer.'), handleValidationErrors, async (req, res) => {
  // Appointment history is permanent; deletion is not allowed.
  res.status(403).json({ error: 'Deleting appointment history is disabled.' });
});

// ---------- Contact form (sends email directly to the MLA) ----------
app.post('/api/contact', publicSubmissionLimiter, contactValidation, async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    await sendContactMessage({
      name: stripHtml(name),
      email: stripHtml(email),
      phone: phone ? stripHtml(phone) : null,
      message: stripHtml(message)
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Could not send your message. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`MLA Appointment System running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin.html`);
  console.log(`Admin password: ${getAdminPassword()} (change via ADMIN_PASSWORD env var)`);
});
