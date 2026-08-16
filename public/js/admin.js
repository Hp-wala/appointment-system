const API_BASE = 'https://mla-appointment-system.onrender.com/api';

const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const logoutNav = document.getElementById('logoutNav');

let allAppointments = [];
let currentFilter = 'all';
let currentView = 'list';
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();
let modalAppointmentId = null;
let modalAction = 'approve';

// ---------- Auth ----------

function isLoggedIn() {
  return sessionStorage.getItem('mla_admin_logged_in') === '1';
}

function setLoggedIn() {
  sessionStorage.setItem('mla_admin_logged_in', '1');
}

function clearLoggedIn() {
  sessionStorage.removeItem('mla_admin_logged_in');
}

async function authFetch(url, options = {}) {
  const headers = Object.assign({}, options.headers, {
    'Content-Type': 'application/json'
  });
  const res = await fetch(url, Object.assign({}, options, { headers, credentials: 'same-origin' }));
  if (res.status === 401) {
    clearLoggedIn();
    showLogin('Session expired. Please log in again.');
    throw new Error('Unauthorized');
  }
  return res;
}

function showLogin(msg) {
  loginView.style.display = 'block';
  dashboardView.style.display = 'none';
  logoutNav.style.display = 'none';
  const loginMsg = document.getElementById('loginMsg');
  if (msg) {
    loginMsg.textContent = msg;
    loginMsg.className = 'form-msg show error';
  } else {
    loginMsg.className = 'form-msg';
  }
}

function showDashboard() {
  loginView.style.display = 'none';
  dashboardView.style.display = 'block';
  logoutNav.style.display = 'block';
  loadAppointments();
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const pw = document.getElementById('adminPassword').value;
  try {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: pw })
    });
    const data = await res.json();
    if (data.success) {
      setLoggedIn();
      showDashboard();
    } else {
      showLogin(data.error || 'Incorrect password.');
    }
  } catch (err) {
    showLogin('Could not reach the server.');
  }
});

function togglePasswordVisibility(inputId, buttonId) {
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  button.textContent = isHidden ? '🙈' : '👁';
  button.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
}

document.getElementById('adminPassword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

document.getElementById('toggleAdminPassword').addEventListener('click', () => {
  togglePasswordVisibility('adminPassword', 'toggleAdminPassword');
});

document.getElementById('toggleResetCode').addEventListener('click', () => {
  togglePasswordVisibility('resetCode', 'toggleResetCode');
});

document.getElementById('toggleResetNewPassword').addEventListener('click', () => {
  togglePasswordVisibility('resetNewPassword', 'toggleResetNewPassword');
});

document.getElementById('toggleResetConfirmPassword').addEventListener('click', () => {
  togglePasswordVisibility('resetConfirmPassword', 'toggleResetConfirmPassword');
});

document.getElementById('forgotPasswordBtn').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('resetPasswordModal').classList.add('show');
});

document.getElementById('closeResetPasswordModal').addEventListener('click', () => {
  document.getElementById('resetPasswordModal').classList.remove('show');
});

document.getElementById('resetPasswordSubmitBtn').addEventListener('click', async () => {
  const resetCode = document.getElementById('resetCode').value.trim();
  const newPassword = document.getElementById('resetNewPassword').value.trim();
  const confirmPassword = document.getElementById('resetConfirmPassword').value.trim();
  const msgEl = document.getElementById('resetPasswordMsg');

  msgEl.textContent = '';
  msgEl.className = 'form-msg';

  if (!resetCode || !newPassword || !confirmPassword) {
    msgEl.textContent = 'Please fill in all fields.';
    msgEl.className = 'form-msg show error';
    return;
  }
  if (newPassword.length < 8) {
    msgEl.textContent = 'New password must be at least 8 characters long.';
    msgEl.className = 'form-msg show error';
    return;
  }
  if (newPassword !== confirmPassword) {
    msgEl.textContent = 'Passwords do not match.';
    msgEl.className = 'form-msg show error';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetCode, newPassword, confirmPassword })
    });
    const data = await res.json();
    if (data.success) {
      msgEl.textContent = 'Password reset successfully. Please log in.';
      msgEl.className = 'form-msg show success';
      document.getElementById('resetCode').value = '';
      document.getElementById('resetNewPassword').value = '';
      document.getElementById('resetConfirmPassword').value = '';
      setTimeout(() => {
        document.getElementById('resetPasswordModal').classList.remove('show');
        msgEl.textContent = '';
        msgEl.className = 'form-msg';
      }, 1400);
      return;
    }
    msgEl.textContent = data.error || 'Unable to reset password.';
    msgEl.className = 'form-msg show error';
  } catch (err) {
    msgEl.textContent = 'Could not reach the server.';
    msgEl.className = 'form-msg show error';
  }
});

document.getElementById('resetPasswordModal').addEventListener('click', (e) => {
  if (e.target.id === 'resetPasswordModal') {
    document.getElementById('resetPasswordModal').classList.remove('show');
  }
});

document.getElementById('logoutLink').addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await fetch(`${API_BASE}/admin/logout`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    // ignore logout errors
  }
  clearLoggedIn();
  showLogin();
});

document.getElementById('handoverBtn').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('handoverModal').classList.add('show');
});

document.getElementById('changePasswordBtn').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('passwordModal').classList.add('show');
});

document.getElementById('historyBtn').addEventListener('click', (e) => {
  e.preventDefault();
  window.open('admin-history.html', '_blank');
});

document.getElementById('closePasswordModal').addEventListener('click', () => {
  document.getElementById('passwordModal').classList.remove('show');
});

document.getElementById('closeHandoverModal').addEventListener('click', () => {
  document.getElementById('handoverModal').classList.remove('show');
});

document.getElementById('closeHandoverBtn').addEventListener('click', () => {
  document.getElementById('handoverModal').classList.remove('show');
});

const handoverModal = document.getElementById('handoverModal');
const handoverFields = Array.from(handoverModal.querySelectorAll('input, textarea'));
const saveHandoverBtn = document.getElementById('saveHandoverBtn');

function setHandoverLocked(locked) {
  handoverFields.forEach((el) => {
    el.disabled = locked;
  });
  saveHandoverBtn.disabled = locked;
  saveHandoverBtn.textContent = locked ? 'Saved' : 'Save';
  if (locked) {
    saveHandoverBtn.classList.add('btn-success');
    saveHandoverBtn.classList.remove('btn-primary');
  } else {
    saveHandoverBtn.classList.remove('btn-success');
    saveHandoverBtn.classList.add('btn-primary');
  }
}

function loadHandoverState() {
  const savedData = localStorage.getItem('handoverFormData');
  const locked = localStorage.getItem('handoverFormLocked') === '1';
  if (savedData) {
    const values = JSON.parse(savedData);
    handoverFields.forEach((el) => {
      if (values[el.id] !== undefined) {
        el.value = values[el.id];
      }
    });
  }
  setHandoverLocked(locked);
}

function saveHandoverState() {
  const values = {};
  handoverFields.forEach((el) => {
    values[el.id] = el.value;
  });
  localStorage.setItem('handoverFormData', JSON.stringify(values));
  localStorage.setItem('handoverFormLocked', '1');
  setHandoverLocked(true);
}

document.getElementById('printHandoverBtn').addEventListener('click', () => {
  window.print();
});

document.getElementById('saveHandoverBtn').addEventListener('click', () => {
  saveHandoverState();
});

document.getElementById('savePasswordBtn').addEventListener('click', async () => {
  const currentPassword = document.getElementById('passwordCurrent').value.trim();
  const newPassword = document.getElementById('passwordNew').value.trim();
  const confirmPassword = document.getElementById('passwordConfirm').value.trim();
  const msgEl = document.getElementById('passwordMsg');

  msgEl.textContent = '';
  msgEl.className = 'form-msg';

  if (!currentPassword || !newPassword || !confirmPassword) {
    msgEl.textContent = 'Please complete all password fields.';
    msgEl.className = 'form-msg show error';
    return;
  }
  if (newPassword.length < 8) {
    msgEl.textContent = 'New password must be at least 8 characters long.';
    msgEl.className = 'form-msg show error';
    return;
  }
  if (newPassword !== confirmPassword) {
    msgEl.textContent = 'New password and confirmation do not match.';
    msgEl.className = 'form-msg show error';
    return;
  }

  try {
    const res = await authFetch(`${API_BASE}/admin/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
    const data = await res.json();
    if (data.success) {
      msgEl.textContent = 'Password updated successfully.';
      msgEl.className = 'form-msg show success';
      document.getElementById('passwordCurrent').value = '';
      document.getElementById('passwordNew').value = '';
      document.getElementById('passwordConfirm').value = '';
      setTimeout(() => {
        document.getElementById('passwordModal').classList.remove('show');
        msgEl.textContent = '';
        msgEl.className = 'form-msg';
      }, 1200);
      return;
    }
    msgEl.textContent = data.error || 'Unable to update password.';
    msgEl.className = 'form-msg show error';
  } catch (err) {
    msgEl.textContent = 'Could not reach the server.';
    msgEl.className = 'form-msg show error';
  }
});

document.getElementById('passwordModal').addEventListener('click', (e) => {
  if (e.target.id === 'passwordModal') {
    document.getElementById('passwordModal').classList.remove('show');
  }
});

document.getElementById('handoverModal').addEventListener('click', (e) => {
  if (e.target.id === 'handoverModal') {
    handoverModal.classList.remove('show');
  }
});

loadHandoverState();

// ---------- Data loading ----------

async function loadAppointments() {
  try {
    const res = await authFetch(`${API_BASE}/appointments`);
    allAppointments = await res.json();
    updateCounts();
    renderCurrentView();
  } catch (err) {
    // authFetch already handles redirect to login on 401
  }
}

document.getElementById('refreshBtn').addEventListener('click', loadAppointments);

function updateCounts() {
  const counts = { all: allAppointments.length, pending: 0, approved: 0, rejected: 0, rescheduled: 0 };
  allAppointments.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
  Object.keys(counts).forEach((k) => {
    const el = document.getElementById(`count-${k}`);
    if (el) el.textContent = counts[k];
  });
}

// ---------- Tabs ----------

document.getElementById('viewTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('#viewTabs .tab-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentView = btn.dataset.view;
  document.getElementById('listView').style.display = currentView === 'list' ? 'block' : 'none';
  document.getElementById('calendarView').style.display = currentView === 'calendar' ? 'block' : 'none';
  renderCurrentView();
});

document.getElementById('filterTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('#filterTabs .tab-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.filter;
  renderCurrentView();
});

document.getElementById('sectionTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('#sectionTabs .tab-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const section = btn.dataset.section;
  document.getElementById('appointmentsSection').style.display = section === 'appointments' ? 'block' : 'none';
  document.getElementById('securityLogsSection').style.display = section === 'security' ? 'block' : 'none';
  if (section === 'security') {
    loadSecurityLogs();
  }
});

document.getElementById('refreshLogsBtn').addEventListener('click', loadSecurityLogs);
document.getElementById('securityFilter').addEventListener('change', loadSecurityLogs);

function renderCurrentView() {
  if (currentView === 'list') {
    renderList();
  } else {
    renderCalendar();
  }
}

function renderHistory() {
  const bodyEl = document.getElementById('historyTableBody');
  const counts = { all: allAppointments.length, pending: 0, approved: 0, rejected: 0, rescheduled: 0 };
  allAppointments.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });

  document.getElementById('history-count-all').textContent = counts.all;
  document.getElementById('history-count-pending').textContent = counts.pending;
  document.getElementById('history-count-approved').textContent = counts.approved;
  document.getElementById('history-count-rescheduled').textContent = counts.rescheduled;
  document.getElementById('history-count-rejected').textContent = counts.rejected;

  if (!allAppointments.length) {
    bodyEl.innerHTML = '<tr><td colspan="7" style="padding:14px 10px;color:var(--ink-soft);">No appointment history available.</td></tr>';
    return;
  }

  bodyEl.innerHTML = allAppointments.map((a) => {
    const requested = `${formatDate(a.preferredDate)} ${formatTime(a.preferredTime)}`;
    const confirmed = a.confirmedDate ? `${formatDate(a.confirmedDate)} ${formatTime(a.confirmedTime)}` : '—';
    return `
      <tr>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${escapeHtml(a.name)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${escapeHtml(a.mobile)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);"><span class="status-pill status-${a.status}">${statusLabel(a.status)}</span></td>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${escapeHtml(requested)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${escapeHtml(confirmed)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${formatDate(a.createdAt)} ${formatTime(a.createdAt?.split('T')[1]?.slice(0,5) || '')}</td>
        <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${formatDate(a.updatedAt)} ${formatTime(a.updatedAt?.split('T')[1]?.slice(0,5) || '')}</td>
      </tr>`;
  }).join('');
}

async function loadSecurityLogs() {
  const filter = document.getElementById('securityFilter').value;
  const msgEl = document.getElementById('securityLogMsg');
  const bodyEl = document.getElementById('securityLogsBody');
  msgEl.className = 'form-msg';
  msgEl.textContent = '';
  bodyEl.innerHTML = '<tr><td colspan="5" style="padding:14px 10px;color:var(--ink-soft);">Loading security logs…</td></tr>';

  try {
    const query = filter ? `?eventType=${encodeURIComponent(filter)}` : '';
    const res = await authFetch(`${API_BASE}/admin/security-logs${query}`);
    const logs = await res.json();
    if (!Array.isArray(logs) || !logs.length) {
      bodyEl.innerHTML = '<tr><td colspan="5" style="padding:14px 10px;color:var(--ink-soft);">No security events found.</td></tr>';
      return;
    }

    bodyEl.innerHTML = logs.map((log) => {
      const when = new Date(log.created_at || log.timestamp).toLocaleString('en-IN', { hour12: true });
      const location = log.city && log.country ? `${log.city}, ${log.country}` : log.country || log.region || 'Unknown';
      const mapLink = log.latitude && log.longitude ? `<a href="https://www.google.com/maps?q=${log.latitude},${log.longitude}" target="_blank" rel="noreferrer">View map</a>` : '';
      const badge = eventBadge(log.event_type);
      const detailsText = log.details ? JSON.stringify(log.details) : '';
      return `
        <tr>
          <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${when}</td>
          <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${badge}</td>
          <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${log.ipAddress || 'N/A'}<br><span style="font-size:12px;color:var(--ink-soft);">${location}</span><br>${mapLink}</td>
          <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${log.requestPath || 'N/A'}</td>
          <td style="padding:12px 10px;border-bottom:1px solid var(--line);">${escapeHtml(detailsText)}</td>
        </tr>`;
    }).join('');
  } catch (err) {
    msgEl.textContent = 'Could not load security logs. Please try again.';
    msgEl.className = 'form-msg show error';
    bodyEl.innerHTML = '<tr><td colspan="5" style="padding:14px 10px;color:var(--ink-soft);">Unable to load logs.</td></tr>';
  }
}

function eventBadge(type) {
  const label = {
    admin_login_success: 'Admin login success',
    failed_admin_login: 'Failed admin login',
    rate_limit_exceeded: 'Rate limit exceeded',
    invalid_input_attempt: 'Invalid input attempt'
  }[type] || type;
  const color = {
    admin_login_success: '#1a7f37',
    failed_admin_login: '#c34141',
    rate_limit_exceeded: '#c35a00',
    invalid_input_attempt: '#9a6ee6'
  }[type] || '#475569';
  return `<span style="display:inline-block;padding:5px 10px;border-radius:999px;background:${color};color:#fff;font-size:12px;">${escapeHtml(label)}</span>`;
}

// ---------- List view ----------

function statusLabel(status) {
  return { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', rescheduled: 'Rescheduled' }[status] || status;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hr12 = ((hour + 11) % 12) + 1;
  return `${hr12}:${m} ${suffix}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function renderList() {
  const listEl = document.getElementById('requestList');
  const filtered = currentFilter === 'all'
    ? allAppointments
    : allAppointments.filter((a) => a.status === currentFilter);

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="glyph">📭</div>
        <p>No requests in this category.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = filtered.map(renderAdminCard).join('');
}

function renderAdminCard(a) {
  const isPending = a.status === 'pending';
  const isRescheduled = a.status === 'rescheduled';

  const scheduleLine = (a.status === 'approved' || a.status === 'rescheduled')
    ? `<div class="req-meta">
         <div><span class="k">Confirmed Date</span><strong>${formatDate(a.confirmedDate)}</strong></div>
         <div><span class="k">Confirmed Time</span><strong>${formatTime(a.confirmedTime)}</strong></div>
       </div>`
    : `<div class="req-meta">
         <div><span class="k">Requested Date</span><strong>${formatDate(a.preferredDate)}</strong></div>
         <div><span class="k">Requested Time</span><strong>${formatTime(a.preferredTime)}</strong></div>
       </div>`;

  let actions = '';
  if (isPending || isRescheduled || a.status === 'approved' || a.status === 'rejected') {
    actions = `
      <div class="req-actions">
        <button class="btn btn-approve btn-sm" onclick="handleApprove(${a.id})">Approve</button>
        <button class="btn btn-reschedule btn-sm" onclick="openRescheduleModal(${a.id})">Reschedule</button>
        <button class="btn btn-reject btn-sm" onclick="handleReject(${a.id})">Reject</button>
      </div>`;
  }

  const note = a.adminNote ? `<div class="req-purpose">Office note: ${escapeHtml(a.adminNote)}</div>` : '';

  return `
    <div class="request-card">
      <div class="req-top">
        <div>
          <div class="req-name">${escapeHtml(a.name)}</div>
          <div class="req-token">${a.tokenNumber} · ${escapeHtml(a.mobile)}${a.email ? ' · ' + escapeHtml(a.email) : ''}</div>
        </div>
        <span class="status-pill status-${a.status}">${statusLabel(a.status)}</span>
      </div>
      <div class="req-purpose">${escapeHtml(a.purpose)}</div>
      ${scheduleLine}
      ${note}
      ${actions}
    </div>
  `;
}

// ---------- Actions ----------

function openAppointmentModal(action, id) {
  const appt = allAppointments.find((a) => a.id === id);
  modalAction = action;
  modalAppointmentId = id;

  document.getElementById('modalTitle').textContent = action === 'approve' ? 'Confirm Appointment' : 'Reschedule Appointment';
  document.getElementById('modalActionDesc').textContent = action === 'approve'
    ? 'Select the date and time when the MLA is available, then confirm the appointment.'
    : 'Choose a new date and time for the citizen request and add an optional note.';
  document.getElementById('modalCitizenName').textContent = `${appt.name} originally requested ${formatDate(appt.preferredDate)} at ${formatTime(appt.preferredTime)}.`;
  document.getElementById('modalDate').value = appt.preferredDate || '';
  document.getElementById('modalDate').min = new Date().toISOString().split('T')[0];
  document.getElementById('modalTime').value = appt.preferredTime || '';
  document.getElementById('modalNote').value = '';
  document.getElementById('modalConfirm').textContent = action === 'approve' ? 'Approve Request' : 'Confirm Reschedule';
  document.getElementById('rescheduleModal').classList.add('show');
}

async function handleApprove(id) {
  openAppointmentModal('approve', id);
}

async function handleReject(id) {
  if (!confirm('Reject this appointment request?')) return;
  try {
    await authFetch(`${API_BASE}/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject' })
    });
    loadAppointments();
  } catch (err) { /* handled in authFetch */ }
}

async function handleDelete(id) {
  if (!confirm('Delete this appointment permanently?')) return;
  try {
    await authFetch(`${API_BASE}/appointments/${id}`, {
      method: 'DELETE'
    });
    loadAppointments();
  } catch (err) { /* handled in authFetch */ }
}

function openRescheduleModal(id) {
  const appt = allAppointments.find((a) => a.id === id);
  modalAction = 'reschedule';
  modalAppointmentId = id;
  document.getElementById('modalTitle').textContent = 'Reschedule Appointment';
  document.getElementById('modalActionDesc').textContent = 'Choose a new date and time for the citizen request and add an optional note.';
  document.getElementById('modalConfirm').textContent = 'Confirm Reschedule';
  document.getElementById('modalCitizenName').textContent = `${appt.name} originally requested ${formatDate(appt.preferredDate)} at ${formatTime(appt.preferredTime)}.`;
  document.getElementById('modalDate').value = appt.preferredDate;
  document.getElementById('modalDate').min = new Date().toISOString().split('T')[0];
  document.getElementById('modalTime').value = appt.preferredTime;
  document.getElementById('modalNote').value = '';
  document.getElementById('rescheduleModal').classList.add('show');
}

function closeRescheduleModal() {
  document.getElementById('rescheduleModal').classList.remove('show');
  modalAppointmentId = null;
}

document.getElementById('closeModal').addEventListener('click', closeRescheduleModal);
document.getElementById('modalCancel').addEventListener('click', closeRescheduleModal);
document.getElementById('rescheduleModal').addEventListener('click', (e) => {
  if (e.target.id === 'rescheduleModal') closeRescheduleModal();
});

document.getElementById('modalConfirm').addEventListener('click', async () => {
  const confirmedDate = document.getElementById('modalDate').value;
  const confirmedTime = document.getElementById('modalTime').value;
  const adminNote = document.getElementById('modalNote').value.trim();
  const action = modalAction === 'approve' ? 'approve' : 'reschedule';

  if (!confirmedDate || !confirmedTime) {
    alert('Please pick both a date and a time.');
    return;
  }

  try {
    await authFetch(`${API_BASE}/appointments/${modalAppointmentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, confirmedDate, confirmedTime, adminNote })
    });
    closeRescheduleModal();
    loadAppointments();
  } catch (err) { /* handled in authFetch */ }
});

// ---------- Calendar view ----------

function renderCalendar() {
  const grid = document.getElementById('calGrid');
  const label = document.getElementById('calMonthLabel');
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  label.textContent = `${monthNames[calMonth]} ${calYear}`;

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

  // Appointments confirmed within this month (approved or rescheduled)
  const confirmed = allAppointments.filter((a) =>
    (a.status === 'approved' || a.status === 'rescheduled') && a.confirmedDate
  );

  let cells = '';
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  dow.forEach((d) => { cells += `<div class="cal-dow">${d}</div>`; });

  // Leading days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    cells += `<div class="cal-day muted"><span class="num">${daysInPrevMonth - i}</span></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayAppts = confirmed.filter((a) => a.confirmedDate === dateStr);
    const apptHtml = dayAppts.map((a) =>
      `<div class="cal-appt" title="${escapeHtml(a.name)} — ${formatTime(a.confirmedTime)}">${formatTime(a.confirmedTime)} ${escapeHtml(a.name)}</div>`
    ).join('');
    cells += `<div class="cal-day"><span class="num">${day}</span>${apptHtml}</div>`;
  }

  // Trailing days to fill last row
  const totalCells = firstDay + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    cells += `<div class="cal-day muted"><span class="num">${i}</span></div>`;
  }

  grid.innerHTML = cells;
}

document.getElementById('calPrev').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});

document.getElementById('calNext').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

// ---------- Init ----------

async function initializeAdmin() {
  showLogin();

  if (window.location.protocol === 'file:') {
    showLogin('Open the app through the server, not the file system. Run `node server.js` and visit http://localhost:3000/admin.html');
    return;
  }

  if (!isLoggedIn()) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/validate`, {
      method: 'GET',
      credentials: 'same-origin'
    });
    if (res.ok) {
      setLoggedIn();
      showDashboard();
    } else {
      clearLoggedIn();
      showLogin();
    }
  } catch (err) {
    clearLoggedIn();
    showLogin('Unable to verify session. Please log in.');
  }
}

initializeAdmin();
