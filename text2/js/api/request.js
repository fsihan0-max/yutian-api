const API_BASE = () => window.AppConfig.apiBase;

async function requestJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.error || "Request failed", data };
    }
    return { ok: true, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message || "Network error", data: null };
  }
}

export function getHealth() {
  return requestJson(`${API_BASE()}/api/health`);
}

export function getSamples() {
  return requestJson(`${API_BASE()}/api/samples`);
}

export function postSample(payload) {
  return requestJson(`${API_BASE()}/api/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function postReview(payload) {
  return requestJson(`${API_BASE()}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function postAnalyzeJson(payload) {
  return requestJson(`${API_BASE()}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function postAnalyzeForm(formData) {
  return requestJson(`${API_BASE()}/api/analyze`, {
    method: "POST",
    body: formData
  });
}

export async function geocodeCN(query) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=cn`);
    const data = await response.json().catch(() => []);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch (error) {
    return { ok: false, error: error.message || "Geocode failed", data: [] };
  }
}
