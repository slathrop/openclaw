const WORD_BOUNDARY_CHARS = /[\s\-_./:#@]/;
function isWordBoundary(text, index) {
  return index === 0 || WORD_BOUNDARY_CHARS.test(text[index - 1] ?? '');
}
function findWordBoundaryIndex(text, query) {
  if (!query) {
    return null;
  }
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const maxIndex = textLower.length - queryLower.length;
  if (maxIndex < 0) {
    return null;
  }
  for (let i = 0; i <= maxIndex; i++) {
    if (textLower.startsWith(queryLower, i) && isWordBoundary(textLower, i)) {
      return i;
    }
  }
  return null;
}
function fuzzyMatchLower(queryLower, textLower) {
  if (queryLower.length === 0) {
    return 0;
  }
  if (queryLower.length > textLower.length) {
    return null;
  }
  let queryIndex = 0;
  let score = 0;
  let lastMatchIndex = -1;
  let consecutiveMatches = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      const isAtWordBoundary = isWordBoundary(textLower, i);
      if (lastMatchIndex === i - 1) {
        consecutiveMatches++;
        score -= consecutiveMatches * 5;
      } else {
        consecutiveMatches = 0;
        if (lastMatchIndex >= 0) {
          score += (i - lastMatchIndex - 1) * 2;
        }
      }
      if (isAtWordBoundary) {
        score -= 10;
      }
      score += i * 0.1;
      lastMatchIndex = i;
      queryIndex++;
    }
  }
  return queryIndex < queryLower.length ? null : score;
}
function fuzzyFilterLower(items, queryLower) {
  const trimmed = queryLower.trim();
  if (!trimmed) {
    return items;
  }
  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return items;
  }
  const results = [];
  for (const item of items) {
    const text = item.searchTextLower ?? '';
    let totalScore = 0;
    let allMatch = true;
    for (const token of tokens) {
      const score = fuzzyMatchLower(token, text);
      if (score !== null) {
        totalScore += score;
      } else {
        allMatch = false;
        break;
      }
    }
    if (allMatch) {
      results.push({ item, score: totalScore });
    }
  }
  results.sort((a, b) => a.score - b.score);
  return results.map((r) => r.item);
}
function prepareSearchItems(items) {
  return items.map((item) => {
    const parts = [];
    if (item.label) {
      parts.push(item.label);
    }
    if (item.description) {
      parts.push(item.description);
    }
    if (item.searchText) {
      parts.push(item.searchText);
    }
    return { ...item, searchTextLower: parts.join(' ').toLowerCase() };
  });
}
export {
  findWordBoundaryIndex,
  fuzzyFilterLower,
  fuzzyMatchLower,
  isWordBoundary,
  prepareSearchItems
};
