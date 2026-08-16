// translate-init.js
// Robust Google Translate initialisation.
// Called automatically by the Google Translate script via ?cb=googleTranslateElementInit

function googleTranslateElementInit() {
  // Guard: don't init twice
  if (window._gteInitDone) return;
  window._gteInitDone = true;

  new google.translate.TranslateElement(
    {
      pageLanguage: 'en',
      includedLanguages: 'en,hi,as,bn,gu,kn,ml,mr,or,pa,ta,te,ur,ne,bho',
      autoDisplay: false
      // No layout specified → uses default which renders a <select> dropdown.
      // SIMPLE layout uses a popup iframe that errors with our CSP/CSS setup.
    },
    'google_translate_element'
  );

  // Remove the intrusive top bar Google injects after translation.
  // IMPORTANT: target only 'iframe.skiptranslate' — the widget select
  // is also inside a div.skiptranslate, so hiding the class entirely
  // breaks the dropdown. Only the iframe is the top-banner.
  function suppressTopBar() {
    var bar = document.getElementById('goog-gt-tt');
    if (bar) bar.style.display = 'none';

    // Only hide the IFRAME Google injects as a banner, not the widget div
    var bannerIframes = document.querySelectorAll('iframe.skiptranslate');
    bannerIframes.forEach(function(iframe) {
      iframe.style.display = 'none';
    });

    // Reset body.top Google sets (causes page shift)
    if (document.body && document.body.style.top) {
      document.body.style.top = '';
    }
  }

  // Run once after a short delay to catch the injected bar
  setTimeout(suppressTopBar, 800);

  // Also watch for Google dynamically adding it
  if (window.MutationObserver) {
    var observer = new MutationObserver(function() {
      var bodyTop = document.body && document.body.style.top;
      if (bodyTop && bodyTop !== '0px') {
        document.body.style.top = '';
      }
    });
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    }
  }
}

