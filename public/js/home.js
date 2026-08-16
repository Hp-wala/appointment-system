const HM_API_BASE = 'https://mla-appointment-system.onrender.com/api';

// Prevent picking a past date
const hmDateInput = document.getElementById('hmDate');
if (hmDateInput) hmDateInput.min = new Date().toISOString().split('T')[0];

// Mobile nav toggle — simple show/hide of the nav links list
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.hm-nav-links');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.style.display === 'flex';
    navLinks.style.display = isOpen ? 'none' : 'flex';
    navLinks.style.flexDirection = 'column';
    navLinks.style.position = 'absolute';
    navLinks.style.top = '100%';
    navLinks.style.left = '0';
    navLinks.style.right = '0';
    navLinks.style.background = '#fff';
    navLinks.style.padding = '16px 24px';
    navLinks.style.borderBottom = '1px solid var(--hm-line)';
  });
}

// Contact form — sends a message directly to the MLA's email via the backend
const contactForm = document.getElementById('contactForm');
const contactFormMsg = document.getElementById('contactFormMsg');
const contactSubmitBtn = document.getElementById('contactSubmitBtn');
const whatsappServers = {
  1: '917099012666',
  2: '919435019219',
  3: '919678367047'
};

if (contactForm) {
  const sendWhatsAppMessage = (serverKey) => {
    const payload = {
      name: document.getElementById('cName').value.trim(),
      email: document.getElementById('cEmail').value.trim(),
      phone: document.getElementById('cPhone').value.trim(),
      message: document.getElementById('cMessage').value.trim()
    };

    if (!payload.name || !payload.email || !payload.message) {
      contactFormMsg.textContent = 'Please fill in your Full Name, Email Address, and Message.';
      contactFormMsg.className = 'hm-form-msg show error';
      return;
    }

    const message = [
      'Full Name: ' + payload.name,
      'Email Address: ' + payload.email,
      payload.phone ? 'Phone Number: ' + payload.phone : 'Phone Number: Not provided',
      'Message: ' + payload.message
    ].join('\n');

    const encodedMessage = encodeURIComponent(message);
    const phone = whatsappServers[serverKey];
    const webUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;
    const fallbackUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    const appUrl = `whatsapp://send?phone=${phone}&text=${encodedMessage}`;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    contactFormMsg.textContent = 'Opening WhatsApp...';
    contactFormMsg.className = 'hm-form-msg show success';

    if (isMobile) {
      // On mobile: try the native WhatsApp app first, then fall back to wa.me if the app is not installed.
      const timeout = window.setTimeout(() => {
        window.location.href = fallbackUrl;
      }, 1400);

      window.location.href = appUrl;

      // Cleanup in case the browser remains on this page.
      window.setTimeout(() => window.clearTimeout(timeout), 1500);
    } else {
      // On desktop: open WhatsApp Web in a new tab.
      const newTab = window.open(webUrl, '_blank');
      if (!newTab) {
        // If popup is blocked, fall back to wa.me in the current tab.
        window.location.href = fallbackUrl;
      }
    }
  };

  document.querySelectorAll('.hm-whatsapp-btn').forEach((button) => {
    button.addEventListener('click', () => sendWhatsAppMessage(button.dataset.server));
  });

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    contactFormMsg.className = 'hm-form-msg';

    const payload = {
      name: document.getElementById('cName').value.trim(),
      email: document.getElementById('cEmail').value.trim(),
      phone: document.getElementById('cPhone').value.trim(),
      message: document.getElementById('cMessage').value.trim()
    };

    if (contactSubmitBtn) contactSubmitBtn.disabled = true;
    if (contactSubmitBtn) contactSubmitBtn.textContent = 'Sending…';

    try {
      const res = await fetch(`${HM_API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        contactFormMsg.textContent = data.error || 'Could not send your message. Please try again.';
        contactFormMsg.className = 'hm-form-msg show error';
      } else {
        contactFormMsg.textContent = 'Message sent! The office will get back to you soon.';
        contactFormMsg.className = 'hm-form-msg show success';
        contactForm.reset();
      }
    } catch (err) {
      contactFormMsg.textContent = 'Could not reach the server. Please try again shortly.';
      contactFormMsg.className = 'hm-form-msg show error';
    } finally {
      if (contactSubmitBtn) {
        contactSubmitBtn.disabled = false;
        contactSubmitBtn.textContent = 'Send Message';
      }
    }
  });
}
const heroForm = document.getElementById('heroBookingForm');
// Hero booking form — submits to the same /api/appointments endpoint
// used by the full appointments page.
const hmFormMsg = document.getElementById('hmFormMsg');
const hmSubmitBtn = document.getElementById('hmSubmitBtn');

if (heroForm) {
  heroForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hmFormMsg.className = 'hm-form-msg';

    const payload = {
      name: document.getElementById('hmName').value.trim(),
      mobile: document.getElementById('hmMobile').value.trim(),
      email: document.getElementById('hmEmail').value.trim(),
      purpose: document.getElementById('hmPurpose').value
    };

    if (!/^[0-9]{10}$/.test(payload.mobile)) {
      hmFormMsg.textContent = 'Please enter a valid 10-digit mobile number.';
      hmFormMsg.className = 'hm-form-msg show error';
      return;
    }

    hmSubmitBtn.disabled = true;
    hmSubmitBtn.textContent = 'Submitting…';

    try {
      const res = await fetch(`${HM_API_BASE}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        hmFormMsg.textContent = data.error || 'Something went wrong. Please try again.';
        hmFormMsg.className = 'hm-form-msg show error';
      } else {
        const modal = document.getElementById('heroSuccessModal');
        const modalText = document.getElementById('heroSuccessModalText');
        modalText.innerHTML = `Request submitted! Your token number is <strong>${data.tokenNumber}</strong>. You can check its status any time from the <a href="appointments.html" style="text-decoration:underline;color:#0F2649;">Appointments page</a>.`;
        modal.classList.add('show');
        heroForm.reset();
      }
    } catch (err) {
      hmFormMsg.textContent = 'Could not reach the server. Please try again shortly.';
      hmFormMsg.className = 'hm-form-msg show error';
    } finally {
      hmSubmitBtn.disabled = false;
      hmSubmitBtn.textContent = 'Submit Request';
    }
  });
}
const heroSuccessModal = document.getElementById('heroSuccessModal');
const heroSuccessModalOk = document.getElementById('heroSuccessModalOk');
if (heroSuccessModalOk) {
  heroSuccessModalOk.addEventListener('click', () => {
    heroSuccessModal.classList.remove('show');
  });
}