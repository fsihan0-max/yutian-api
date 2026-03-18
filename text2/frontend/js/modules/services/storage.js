export function readSource(key, seedValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      const seed = cloneValue(seedValue);
      writeSource(key, seed);
      return seed;
    }
    const parsed = JSON.parse(raw);
    return parsed === null || typeof parsed === "undefined" ? cloneValue(seedValue) : parsed;
  } catch {
    const seed = cloneValue(seedValue);
    writeSource(key, seed);
    return seed;
  }
}

export function writeSource(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

