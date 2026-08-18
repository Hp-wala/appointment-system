function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => {
      clearTimeout(timer);
    })
    .catch((error) => {
      if (error && error.name === 'AbortError') {
        const timeoutError = new Error('Request timed out. Please try again in a moment.');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      throw error;
    });
}

if (typeof module !== 'undefined') {
  module.exports = { fetchWithTimeout };
}

if (typeof window !== 'undefined') {
  window.fetchWithTimeout = fetchWithTimeout;
}
