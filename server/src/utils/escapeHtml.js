// בריחת תווים מיוחדים ל-HTML — מונע XSS כשמציגים נתוני משתמש בדפי HTML.
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
