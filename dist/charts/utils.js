const ChartUtils = (() => {
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const score = team => team.analytics?.powerScore || 0;
  const sorted = teams => [...teams].sort((a, b) => score(b) - score(a));
  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const shortName = name => String(name).length > 12 ? `${String(name).slice(0, 11)}…` : String(name);
  return {escapeHtml, score, sorted, mean, shortName};
})();
if (typeof module !== 'undefined') module.exports = ChartUtils;
