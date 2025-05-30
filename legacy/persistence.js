export function loadConfig(k) {
  return JSON.parse(localStorage.getItem(k) || 'null');
}
export function saveConfig(k, v) {
  localStorage.setItem(k, JSON.stringify(v));
}
