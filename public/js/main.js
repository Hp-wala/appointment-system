const API_BASE = 'https://mla-appointment-system.onrender.com/api';

async function fetchWithTimeout(url, options = {}, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (error) {
    if (error && error.name === 'AbortError') {
      const timeoutError = new Error('Request timed out. Please try again in a moment.');
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const bookingForm = document.getElementById('bookingForm');
const formMsg = document.getElementById('formMsg');
const submitBtn = document.getElementById('submitBtn');

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = 'form-msg show ' + type;
}

function statusLabel(status) {
  return { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', rescheduled: 'Rescheduled' }[status] || status;
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hr12 = ((hour + 11) % 12) + 1;
  return `${hr12}:${m} ${suffix}`;
}

bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.className = 'form-msg';

  const payload = {
    name: document.getElementById('name').value.trim(),
    mobile: document.getElementById('mobile').value.trim(),
    email: document.getElementById('email').value.trim(),
    purpose: document.getElementById('purpose').value.trim()
  };

  if (!/^[0-9]{10}$/.test(payload.mobile)) {
    showMsg(formMsg, 'Please enter a valid 10-digit mobile number.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Submitting…';

  try {
    const res = await fetchWithTimeout(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 18000);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showMsg(formMsg, data.error || 'Something went wrong. Please try again.', 'error');
    } else {
      formMsg.innerHTML = `
        <div class="token-slip" style="margin-top:0;border-style:solid;">
          <div class="token-label">Request submitted · Your token number</div>
          <div class="token-number">${data.tokenNumber}</div>
        </div>
        <p style="font-size:13px;color:var(--ink-soft);margin-top:10px;">Save this number. You can check your status any time using your mobile number.</p>
      `;
      formMsg.className = 'form-msg show success';
      bookingForm.reset();
    }
  } catch (err) {
    const msg = err && err.name === 'TimeoutError'
      ? 'The server is taking too long to respond. Please try again in a moment.'
      : 'Could not reach the server. Please try again shortly.';
    showMsg(formMsg, msg, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Submit Request';
  }
});

document.getElementById('checkStatusBtn').addEventListener('click', async () => {
  const mobile = document.getElementById('statusMobile').value.trim();
  const email = document.getElementById('statusEmail').value.trim();
  const resultsEl = document.getElementById('statusResults');

  resultsEl.className = 'hm-form-msg';

  if (!/^[0-9]{10}$/.test(mobile)) {
    resultsEl.className = 'hm-form-msg show error';
    resultsEl.innerHTML = 'Enter a valid 10-digit mobile number.';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    resultsEl.className = 'hm-form-msg show error';
    resultsEl.innerHTML = 'Enter the same email address you used when submitting the request.';
    return;
  }

  resultsEl.className = 'hm-form-msg show';
  resultsEl.innerHTML = '<p style="font-size:13px;color:var(--ink-soft);"><span class="spinner" style="width:12px;height:12px;border-width:2px;vertical-align:middle;display:inline-block;margin-right:6px;"></span>Looking up your requests…</p>';

  try {
    const res = await fetchWithTimeout(`${API_BASE}/appointments/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, email })
    }, 18000);
    const appointments = await res.json().catch(() => []);

    if (!appointments.length) {
      resultsEl.className = 'hm-form-msg show';
      resultsEl.innerHTML = `
        <div class="empty-state">
          <div class="glyph">🗂️</div>
          <p>No requests found for this number.</p>
        </div>`;
      return;
    }

    resultsEl.className = 'hm-form-msg show';
    resultsEl.innerHTML = appointments.map(renderCitizenCard).join('');
  } catch (err) {
    const msg = err && err.name === 'TimeoutError'
      ? 'The server is taking too long to respond. Please try again in a moment.'
      : 'Could not reach the server. Please try again shortly.';
    resultsEl.className = 'hm-form-msg show error';
    resultsEl.innerHTML = msg;
  }
});

function renderCitizenCard(a) {
  const statusHtml = `<span class="status-pill status-${a.status}">${statusLabel(a.status)}</span>`;

  let dateTimeBlock = '';
  if (a.status === 'approved' || a.status === 'rescheduled') {
    dateTimeBlock = `
      <div class="req-meta">
        <div><span class="k">Confirmed Date</span><strong>${formatDate(a.confirmedDate)}</strong></div>
        <div><span class="k">Confirmed Time</span><strong>${formatTime(a.confirmedTime)}</strong></div>
      </div>`;
  } else if (a.status === 'pending') {
    dateTimeBlock = `
      <div class="req-meta">
        <div><span class="k">Requested Date</span><strong>${formatDate(a.preferredDate)}</strong></div>
        <div><span class="k">Requested Time</span><strong>${formatTime(a.preferredTime)}</strong></div>
      </div>`;
  } else if (a.status === 'rejected') {
    dateTimeBlock = `<p style="font-size:13px;color:var(--ink-soft);">This request was not approved. You're welcome to submit a new request with an alternate date.</p>`;
  }

  const note = a.adminNote ? `<div class="req-purpose">Note from office: ${escapeHtml(a.adminNote)}</div>` : '';

  return `
    <div class="request-card">
      <div class="req-top">
        <div>
          <div class="req-name">${escapeHtml(a.name)}</div>
          <div class="req-token">${a.tokenNumber}</div>
        </div>
        ${statusHtml}
      </div>
      ${dateTimeBlock}
      ${note}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
