// mailer.js
// Sends contact-form messages straight to the MLA's inbox using SMTP.
// Configure via .env — see .env.example for the fields needed.
// Works out of the box with a Gmail account + an "App Password"
// (Google Account → Security → 2-Step Verification → App Passwords).
// Any other SMTP provider (Outlook, Zoho, your own domain email, etc.)
// works too — just change SMTP_HOST / SMTP_PORT accordingly.

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null; // not configured yet
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465, // true for port 465, false for others
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  return transporter;
}

async function sendContactMessage({ name, email, phone, message }) {
  const t = getTransporter();
  const toEmail = process.env.MLA_EMAIL || process.env.SMTP_USER;

  if (!t) {
    throw new Error(
      'Email is not configured yet. Set SMTP_HOST, SMTP_USER, SMTP_PASS (and optionally MLA_EMAIL) in .env.'
    );
  }

  await t.sendMail({
    from: `"MLA Office Website" <${process.env.SMTP_USER}>`,
    to: toEmail,
    replyTo: email,
    subject: `New message from ${name} (via MLA website contact form)`,
    text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || '—'}\n\nMessage:\n${message}`,
    html: `
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || '—')}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
    `
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { sendContactMessage };
