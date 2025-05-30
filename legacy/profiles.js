const KEY = 'schlaflichtProfiles';
export function loadProfiles(){
  return JSON.parse(localStorage.getItem(KEY)||'[]');
}
export function saveProfiles(p){
  localStorage.setItem(KEY, JSON.stringify(p));
}