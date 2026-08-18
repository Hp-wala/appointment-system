const API_BASE = 'https://mla-appointment-system.onrender.com/api';

const historyTableBody = document.getElementById('historyTableBody');
const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
const historyCounts = {
  all: document.getElementById('history-count-all'),
  pending: document.getElementById('history-count-pending'),
  approved: document.getElementById('history-count-approved'),
  rescheduled: document.getElementById('history-count-rescheduled'),
  rejected: document.getElementById('history-count-rejected')
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hr12 = ((hour + 11) % 12) + 1;
  return `${hr12}:${m} ${suffix}`;
}

async function fetchAppointments() {
  try {
    const token = sessionStorage.getItem('mla_admin_token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}/appointments`, { headers, credentials: 'same-origin' });
    if (!res.ok) throw new Error('Unauthorized or failed request');
    return await res.json();
  } catch (err) {
    historyTableBody.innerHTML = '<tr><td colspan="7" style="padding:14px 10px;color:#c34141;">Could not load history. Please sign in through the admin dashboard.</td></tr>';
    return [];
  }
}

function renderHistory(appointments) {
  const counts = { all: appointments.length, pending: 0, approved: 0, rejected: 0, rescheduled: 0 };
  appointments.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
  Object.keys(historyCounts).forEach((key) => {
    historyCounts[key].textContent = counts[key] || 0;
  });

  if (!appointments.length) {
    historyTableBody.innerHTML = '<tr><td colspan="7" style="padding:14px 10px;color:var(--ink-soft);">No appointment history available.</td></tr>';
    return;
  }

  historyTableBody.innerHTML = appointments.map((a) => {
    const requested = `${formatDate(a.preferredDate)} ${formatTime(a.preferredTime)}`;
    const confirmed = a.confirmedDate ? `${formatDate(a.confirmedDate)} ${formatTime(a.confirmedTime)}` : '—';
    const createdAt = a.createdAt ? `${formatDate(a.createdAt)} ${formatTime(a.createdAt.split('T')[1]?.slice(0,5) || '')}` : '—';
    const updatedAt = a.updatedAt ? `${formatDate(a.updatedAt)} ${formatTime(a.updatedAt.split('T')[1]?.slice(0,5) || '')}` : '—';
    return `
      <tr>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${escapeHtml(a.name)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${escapeHtml(a.mobile)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${escapeHtml(a.status)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${escapeHtml(requested)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${escapeHtml(confirmed)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${escapeHtml(createdAt)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${escapeHtml(updatedAt)}</td>
      </tr>`;
  }).join('');
}

async function init() {
  const appointments = await fetchAppointments();
  renderHistory(appointments);
}

refreshHistoryBtn.addEventListener('click', init);

document.getElementById('handoverBtn').addEventListener('click', () => {
  window.open('admin.html', '_blank');
});

document.getElementById('logoutLink').addEventListener('click', () => {
  window.location.href = 'index.html';
});

init();
