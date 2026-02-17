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
  "기억",
  "주의할",
  "주의해야",
  "유념",
  "중요한",
  "핵심은",
  "핵심은 바로",
  "핵심적으로",
  "가장 중요한",
  "가장 중요한 것은",
  "가장 중요한 점",
  "반드시 기억",
  "꼭 기억",
  "잊지 말",
  "주의 깊게",
  "유의할 점",
  "유의할 사항",
  "특히",
  "특별히",
  "특히 중요한",
  "특히 유의",
  "중요 포인트",
  "중요한 점",
  "중요한 것은",
  "요점은",
  "요점은 바로",
  "요약하면",
  "정리하면",
  "다시 말해",
  "즉",
  "바꿔 말하면",
  "결국",
  "그러므로",
  "따라서",
  "그렇기에",
  "결과적으로",
  "결론적으로",
  "요컨대",
  "한마디로",
  "한 줄 요약",
  "포인트는",
  "포인트는 바로",
  "결정적인",
  "핵심 메시지",
  "필수 사항",
  "필수로",
  "반드시 해야",
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

const particlePattern = /(은|는|이|가|을|를|과|와|의|에|에서|에게|께서|으로|로|로서|로써|보다|부터|까지|밖에|조차|마저|만|도|뿐|이나|나)$/;

const normalizeToken = (token) => {
  const lower = token.toLowerCase();
  if (/[가-힣]/.test(lower)) {
    let trimmed = lower;
    let previous = null;
    while (trimmed !== previous) {
      previous = trimmed;
      trimmed = trimmed.replace(particlePattern, "");
    }
    return trimmed;
  }
  return lower;
};

const buildHighlightedHTML = (text, contextRanges, repeatRanges) => {
  const allRanges = [...contextRanges, ...repeatRanges];
  if (allRanges.length === 0) return `<p class="placeholder">문맥 강조 또는 반복된 항목이 없습니다.</p>`;

  const boundaries = new Set([0, text.length]);
  for (const range of allRanges) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }
  const points = Array.from(boundaries).sort((a, b) => a - b);
  const sortedContext = [...contextRanges].sort((a, b) => a.start - b.start);
  const sortedRepeat = [...repeatRanges].sort((a, b) => a.start - b.start);

  let contextIndex = 0;
  let repeatIndex = 0;
  let activeContext = [];
  let activeRepeat = [];
  let html = "";

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (start === end) continue;

    while (contextIndex < sortedContext.length && sortedContext[contextIndex].start <= start) {
      if (sortedContext[contextIndex].end > start) activeContext.push(sortedContext[contextIndex]);
      contextIndex += 1;
    }
    activeContext = activeContext.filter((range) => range.end > start);

    while (repeatIndex < sortedRepeat.length && sortedRepeat[repeatIndex].start <= start) {
      if (sortedRepeat[repeatIndex].end > start) activeRepeat.push(sortedRepeat[repeatIndex]);
      repeatIndex += 1;
    }
    activeRepeat = activeRepeat.filter((range) => range.end > start);

    const segment = escapeHTML(text.slice(start, end));
    if (!segment) continue;

    const hasRepeat = activeRepeat.length > 0;
    const hasContext = activeContext.length > 0;
    if (!hasRepeat && !hasContext) {
      html += segment;
      continue;
    }

    const labels = new Set();
    if (hasContext) activeContext.forEach((range) => labels.add(range.label));
    if (hasRepeat) activeRepeat.forEach((range) => labels.add(range.label));
    const typeClass = hasRepeat ? "repeat" : "context";
    html += `<span class="highlight ${typeClass}" title="${escapeHTML(Array.from(labels).join(", "))}">${segment}</span>`;
  }

  return html;
};

const collectRepeatedTokens = (text, minCount, minToken) => {
  const tokenRegex = /[A-Za-z][A-Za-z'\-]{1,}|[가-힣]{2,}/g;
  const counts = new Map();
  const entries = [];
  let match = null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const token = match[0];
    const normalized = normalizeToken(token);
    if (!normalized) continue;
    if (normalized.length < minToken) continue;
    if (stopwords.has(normalized)) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
    entries.push({ start: match.index, end: match.index + token.length, token, normalized });
  }

  const ranges = entries
    .filter((entry) => counts.get(entry.normalized) >= minCount)
    .map((entry) => ({ start: entry.start, end: entry.end }));

  return { counts, ranges };
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
    return;
  }

  const minRepeat = Math.max(2, Number(minRepeatInput.value) || 2);
  const minToken = Math.max(2, Number(minTokenInput.value) || 2);

  const contextRanges = contextPatterns.flatMap((pattern) =>
    collectRangesFromPattern(text, pattern.regex, pattern.label, "context")
  );

  const sentenceRanges = collectContextSentenceRanges(text);
  const allContextRanges = [...contextRanges, ...sentenceRanges];

  const { counts, ranges: repeatRanges } = collectRepeatedTokens(text, minRepeat, minToken);
  const repeatRangeObjects = repeatRanges.map((range) => ({
    ...range,
    label: "반복",
    type: "repeat",
    snippet: text.slice(range.start, range.end),
  }));

  highlightedOutput.innerHTML = buildHighlightedHTML(text, allContextRanges, repeatRangeObjects);

  const contextItems = allContextRanges
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
