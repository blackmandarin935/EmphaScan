const inputText = document.getElementById("inputText");
const analyzeBtn = document.getElementById("analyzeBtn");
const highlightedOutput = document.getElementById("highlightedOutput");
const summaryStats = document.getElementById("summaryStats");
const emphasisList = document.getElementById("emphasisList");
const repeatList = document.getElementById("repeatList");
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
  "나",
  "너",
  "저",
  "우리",
  "너희",
  "그들",
  "이들",
  "그들",
  "이것",
  "그것",
  "저것",
  "누구",
  "모두",
  "아무",
  "여기",
  "거기",
  "저기",
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
  "있다",
  "있어",
  "있어요",
  "없다",
  "없어요",
  "하다",
  "해요",
  "합니다",
  "하는",
  "했다",
  "된다",
  "되다",
  "되요",
  "되어",
  "된다",
  "없는",
  "있는",
  "이다",
  "이고",
  "이며",
  "이라",
  "라고",
  "이라서",
  "이라는",
  "그리고",
  "또한",
  "또",
  "즉",
  "또는",
  "같은",
  "처럼",
  "에서",
  "에게",
  "한테",
  "께서",
  "부터",
  "까지",
  "으로",
  "로서",
  "로써",
  "보다",
  "마다",
  "밖에",
  "조차",
  "마저",
  "등",
  "등등",
  "정도",
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
  "you",
  "your",
  "ours",
  "their",
  "them",
  "she",
  "he",
  "they",
  "his",
  "her",
]);

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
  if (ranges.length === 0) return `<p class="placeholder">문맥 강조 또는 반복된 항목이 없습니다.</p>`;
  let cursor = 0;
  let html = "";
  for (const range of ranges) {
    if (range.start > cursor) {
      html += escapeHTML(text.slice(cursor, range.start));
    }
    const content = escapeHTML(text.slice(range.start, range.end));
    const typeClass = range.types.includes("repeat") ? "repeat" : "context";
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

const renderSummary = (stats, contextItems, repeatedItems) => {
  summaryStats.innerHTML = `
    <h3>통계</h3>
    <div><span class="tag">문맥 강조</span> ${stats.context}</div>
    <div><span class="tag">반복</span> ${stats.repeat}</div>
  `;

  emphasisList.innerHTML = `
    <h3>문맥상 강조 문장</h3>
    ${contextItems.length ? `<ul>${contextItems.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>` : "<p class=\"placeholder\">없음</p>"}
  `;

  repeatList.innerHTML = `
    <h3>반복된 항목</h3>
    ${repeatedItems.length ? `<ul>${repeatedItems.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>` : "<p class=\"placeholder\">없음</p>"}
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
    ...contextRanges,
    ...sentenceRanges,
    ...repeatRangeObjects,
  ]);

  highlightedOutput.innerHTML = highlightText(text, mergedRanges);

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
      context: contextRanges.length + sentenceRanges.length,
      repeat: repeatedItems.length,
    },
    contextItems,
    repeatedItems
  );
};

analyzeBtn.addEventListener("click", analyzeText);
