const inputText = document.getElementById("inputText");
const analyzeBtn = document.getElementById("analyzeBtn");
const highlightedOutput = document.getElementById("highlightedOutput");
const summaryStats = document.getElementById("summaryStats");
const emphasisList = document.getElementById("emphasisList");
const repeatList = document.getElementById("repeatList");
const rulesList = document.getElementById("rulesList");
const minRepeatInput = document.getElementById("minRepeat");
const minTokenInput = document.getElementById("minToken");

const emphasisKeywords = [
  "꼭 알아두어야",
  "반드시",
  "중요",
  "핵심",
  "필수",
  "유의",
  "주의",
  "명심",
  "결론적으로",
  "가장 중요",
  "바로",
];

const stopwords = new Set([
  "그리고",
  "그러나",
  "그래서",
  "하지만",
  "때문에",
  "무엇",
  "이것",
  "저것",
  "그것",
  "이것은",
  "그것은",
  "저것은",
  "입니다",
  "합니다",
  "있습니다",
  "있어요",
  "없는",
  "있는",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "are",
  "was",
  "were",
  "has",
  "have",
  "your",
]);

const emphasisPatterns = [
  { label: "굵게", regex: /\*\*([\s\S]*?)\*\*/g },
  { label: "기울임", regex: /\*([^*\n][\s\S]*?)\*/g },
  { label: "밑줄", regex: /__([\s\S]*?)__/g },
  { label: "하이라이트", regex: /==([\s\S]*?)==/g },
  { label: "strong 태그", regex: /<strong>([\s\S]*?)<\/strong>/gi },
  { label: "em 태그", regex: /<em>([\s\S]*?)<\/em>/gi },
  { label: "mark 태그", regex: /<mark>([\s\S]*?)<\/mark>/gi },
  { label: "u 태그", regex: /<u>([\s\S]*?)<\/u>/gi },
];

const contextPatterns = [
  {
    label: "문맥상 강조: 꼭 알아두어야 하는 것은",
    regex: /꼭\s*알아두어야\s*하는\s*것은[^\.\n!\?]+/g,
  },
  {
    label: "문맥상 강조: ~는 바로",
    regex: /[^\s]+\s*는\s*바로[^\.\n!\?]+/g,
  },
  {
    label: "문맥상 강조: ~는 무엇입니다",
    regex: /[^\s]+\s*는\s*(?:바로\s*)?무엇입니다/g,
  },
];

const escapeHTML = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const collectRangesFromPattern = (text, regex, label, type) => {
  const ranges = [];
  let match = null;
  while ((match = regex.exec(text)) !== null) {
    const full = match[0];
    const group = match[1] || full;
    const groupIndex = full.indexOf(group);
    const start = match.index + (groupIndex >= 0 ? groupIndex : 0);
    const end = start + group.length;
    if (group.trim().length === 0) continue;
    ranges.push({ start, end, label, type, snippet: group.trim() });
  }
  return ranges;
};

const collectContextSentenceRanges = (text) => {
  const ranges = [];
  const sentenceRegex = /[^\.\n!\?。！？]+[\.\n!\?。！？]?/g;
  let match = null;
  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = match[0];
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const hasKeyword = emphasisKeywords.some((kw) => trimmed.includes(kw));
    if (!hasKeyword) continue;
    ranges.push({
      start: match.index,
      end: match.index + sentence.length,
      label: "문맥상 강조 문장",
      type: "context",
      snippet: trimmed,
    });
  }
  return ranges;
};

const mergeRanges = (ranges) => {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({
        ...range,
        labels: new Set([range.label]),
        types: new Set([range.type]),
      });
      continue;
    }
    last.end = Math.max(last.end, range.end);
    last.labels.add(range.label);
    last.types.add(range.type);
  }
  return merged.map((item) => ({
    ...item,
    labels: Array.from(item.labels),
    types: Array.from(item.types),
  }));
};

const highlightText = (text, ranges) => {
  if (ranges.length === 0) return `<p class="placeholder">강조 또는 반복된 항목이 없습니다.</p>`;
  let cursor = 0;
  let html = "";
  for (const range of ranges) {
    if (range.start > cursor) {
      html += escapeHTML(text.slice(cursor, range.start));
    }
    const content = escapeHTML(text.slice(range.start, range.end));
    const typeClass = range.types.includes("repeat")
      ? "repeat"
      : range.types.includes("context")
      ? "context"
      : "emphasis";
    const tooltip = escapeHTML(range.labels.join(", "));
    html += `<span class="highlight ${typeClass}" title="${tooltip}">${content}</span>`;
    cursor = range.end;
  }
  html += escapeHTML(text.slice(cursor));
  return html;
};

const collectRepeatedTokens = (text, minCount, minToken) => {
  const tokenRegex = /[A-Za-z][A-Za-z'\-]{1,}|[가-힣]{2,}/g;
  const tokens = text.match(tokenRegex) || [];
  const counts = new Map();
  const positions = new Map();

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (normalized.length < minToken) continue;
    if (stopwords.has(normalized)) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  for (const [token, count] of counts.entries()) {
    if (count < minCount) continue;
    const escaped = escapeRegExp(token);
    const isEnglish = /[a-z]/.test(token);
    const regex = isEnglish ? new RegExp(`\\b${escaped}\\b`, "gi") : new RegExp(escaped, "g");
    let match = null;
    while ((match = regex.exec(text)) !== null) {
      const range = { start: match.index, end: match.index + match[0].length };
      const key = `${range.start}-${range.end}`;
      if (!positions.has(key)) positions.set(key, range);
    }
  }

  return { counts, ranges: Array.from(positions.values()) };
};

const renderSummary = (stats, emphasisItems, repeatedItems) => {
  summaryStats.innerHTML = `
    <h3>통계</h3>
    <div><span class="tag">강조</span> ${stats.emphasis}</div>
    <div><span class="tag">문맥</span> ${stats.context}</div>
    <div><span class="tag">반복</span> ${stats.repeat}</div>
  `;

  emphasisList.innerHTML = `
    <h3>강조된 항목</h3>
    ${emphasisItems.length ? `<ul>${emphasisItems.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>` : "<p class=\"placeholder\">없음</p>"}
  `;

  repeatList.innerHTML = `
    <h3>반복된 항목</h3>
    ${repeatedItems.length ? `<ul>${repeatedItems.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>` : "<p class=\"placeholder\">없음</p>"}
  `;
};

const renderRules = () => {
  rulesList.innerHTML = `
    <h3>감지 규칙</h3>
    <ul>
      <li>굵게/기울임/밑줄/하이라이트/HTML 강조 태그</li>
      <li>문맥상 강조 키워드: ${emphasisKeywords.join(", ")}</li>
      <li>반복 단어: 최소 ${minRepeatInput.value}회 이상</li>
    </ul>
  `;
};

const analyzeText = () => {
  const text = inputText.value;
  if (!text.trim()) {
    highlightedOutput.innerHTML = '<p class="placeholder">분석할 텍스트가 없습니다.</p>';
    summaryStats.innerHTML = "";
    emphasisList.innerHTML = "";
    repeatList.innerHTML = "";
    rulesList.innerHTML = "";
    return;
  }

  const minRepeat = Math.max(2, Number(minRepeatInput.value) || 2);
  const minToken = Math.max(2, Number(minTokenInput.value) || 2);

  const emphasisRanges = emphasisPatterns.flatMap((pattern) =>
    collectRangesFromPattern(text, pattern.regex, pattern.label, "emphasis")
  );

  const contextRanges = contextPatterns.flatMap((pattern) =>
    collectRangesFromPattern(text, pattern.regex, pattern.label, "context")
  );

  const sentenceRanges = collectContextSentenceRanges(text);

  const { counts, ranges: repeatRanges } = collectRepeatedTokens(text, minRepeat, minToken);
  const repeatRangeObjects = repeatRanges.map((range) => ({
    ...range,
    label: "반복",
    type: "repeat",
    snippet: text.slice(range.start, range.end),
  }));

  const mergedRanges = mergeRanges([
    ...emphasisRanges,
    ...contextRanges,
    ...sentenceRanges,
    ...repeatRangeObjects,
  ]);

  highlightedOutput.innerHTML = highlightText(text, mergedRanges);

  const emphasisItems = emphasisRanges
    .map((range) => `${range.label}: ${range.snippet}`)
    .slice(0, 20);
  const contextItems = [...contextRanges, ...sentenceRanges]
    .map((range) => `${range.label}: ${range.snippet}`)
    .slice(0, 20);
  const repeatedItems = Array.from(counts.entries())
    .filter(([_, count]) => count >= minRepeat)
    .sort((a, b) => b[1] - a[1])
    .map(([token, count]) => `${token} (${count}회)`)
    .slice(0, 30);

  renderSummary(
    {
      emphasis: emphasisRanges.length,
      context: contextRanges.length + sentenceRanges.length,
      repeat: repeatedItems.length,
    },
    [...emphasisItems, ...contextItems],
    repeatedItems
  );

  renderRules();
};

analyzeBtn.addEventListener("click", analyzeText);
renderRules();
