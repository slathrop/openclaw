import {

  // SECURITY: This module handles security-sensitive operations.
  // Changes should be reviewed carefully for security implications.

  getEditorKeybindings,
  Input,
  isKeyRelease,
  matchesKey,
  truncateToWidth
} from '@mariozechner/pi-tui';
import { visibleWidth } from '../../terminal/ansi.js';
import { findWordBoundaryIndex, fuzzyFilterLower, prepareSearchItems } from './fuzzy-filter.js';
class SearchableSelectList {
  _items;
  _filteredItems;
  _selectedIndex = 0;
  _maxVisible;
  _theme;
  _searchInput;
  _regexCache = /* @__PURE__ */ new Map();
  onSelect;
  onCancel;
  onSelectionChange;
  constructor(items, maxVisible, theme) {
    this._items = items;
    this._filteredItems = items;
    this._maxVisible = maxVisible;
    this._theme = theme;
    this._searchInput = new Input();
  }
  _getCachedRegex(pattern) {
    let regex = this._regexCache.get(pattern);
    if (!regex) {
      regex = new RegExp(this._escapeRegex(pattern), 'gi');
      this._regexCache.set(pattern, regex);
    }
    return regex;
  }
  _updateFilter() {
    const query = this._searchInput.getValue().trim();
    if (!query) {
      this._filteredItems = this._items;
    } else {
      this._filteredItems = this._smartFilter(query);
    }
    this._selectedIndex = 0;
    this._notifySelectionChange();
  }
  /**
   * Smart filtering that prioritizes:
   * 1. Exact substring match in label (highest priority)
   * 2. Word-boundary prefix match in label
   * 3. Exact substring in description
   * 4. Fuzzy match (lowest priority)
   * @param query
   */
  _smartFilter(query) {
    const q = query.toLowerCase();
    const scoredItems = [];
    const fuzzyCandidates = [];
    for (const item of this._items) {
      const label = item.label.toLowerCase();
      const desc = (item.description ?? '').toLowerCase();
      const labelIndex = label.indexOf(q);
      if (labelIndex !== -1) {
        scoredItems.push({ item, tier: 0, score: labelIndex });
        continue;
      }
      const wordBoundaryIndex = findWordBoundaryIndex(label, q);
      if (wordBoundaryIndex !== null) {
        scoredItems.push({ item, tier: 1, score: wordBoundaryIndex });
        continue;
      }
      const descIndex = desc.indexOf(q);
      if (descIndex !== -1) {
        scoredItems.push({ item, tier: 2, score: descIndex });
        continue;
      }
      fuzzyCandidates.push(item);
    }
    scoredItems.sort(this._compareByScore);
    const preparedCandidates = prepareSearchItems(fuzzyCandidates);
    const fuzzyMatches = fuzzyFilterLower(preparedCandidates, q);
    return [...scoredItems.map((s) => s.item), ...fuzzyMatches];
  }
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  _compareByScore = (a, b) => {
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    return this._getItemLabel(a.item).localeCompare(this._getItemLabel(b.item));
  };
  _getItemLabel(item) {
    return item.label || item.value;
  }
  _highlightMatch(text, query) {
    const tokens = query.trim().split(/\s+/).map((token) => token.toLowerCase()).filter((token) => token.length > 0);
    if (tokens.length === 0) {
      return text;
    }
    const uniqueTokens = Array.from(new Set(tokens)).toSorted((a, b) => b.length - a.length);
    let result = text;
    for (const token of uniqueTokens) {
      const regex = this._getCachedRegex(token);
      result = result.replace(regex, (match) => this._theme.matchHighlight(match));
    }
    return result;
  }
  setSelectedIndex(index) {
    this._selectedIndex = Math.max(0, Math.min(index, this._filteredItems.length - 1));
  }
  invalidate() {
    this._searchInput.invalidate();
  }
  render(width) {
    const lines = [];
    const promptText = 'search: ';
    const prompt = this._theme.searchPrompt(promptText);
    const inputWidth = Math.max(1, width - visibleWidth(prompt));
    const inputLines = this._searchInput.render(inputWidth);
    const inputText = inputLines[0] ?? '';
    lines.push(`${prompt}${this._theme.searchInput(inputText)}`);
    lines.push('');
    const query = this._searchInput.getValue().trim();
    if (this._filteredItems.length === 0) {
      lines.push(this._theme.noMatch('  No matches'));
      return lines;
    }
    const startIndex = Math.max(
      0,
      Math.min(
        this._selectedIndex - Math.floor(this._maxVisible / 2),
        this._filteredItems.length - this._maxVisible
      )
    );
    const endIndex = Math.min(startIndex + this._maxVisible, this._filteredItems.length);
    for (let i = startIndex; i < endIndex; i++) {
      const item = this._filteredItems[i];
      if (!item) {
        continue;
      }
      const isSelected = i === this._selectedIndex;
      lines.push(this._renderItemLine(item, isSelected, width, query));
    }
    if (this._filteredItems.length > this._maxVisible) {
      const scrollInfo = `${this._selectedIndex + 1}/${this._filteredItems.length}`;
      lines.push(this._theme.scrollInfo(`  ${scrollInfo}`));
    }
    return lines;
  }
  _renderItemLine(item, isSelected, width, query) {
    const prefix = isSelected ? '\u2192 ' : '  ';
    const prefixWidth = prefix.length;
    const displayValue = this._getItemLabel(item);
    if (item.description && width > 40) {
      const maxValueWidth = Math.min(30, width - prefixWidth - 4);
      const truncatedValue2 = truncateToWidth(displayValue, maxValueWidth, '');
      const valueText2 = this._highlightMatch(truncatedValue2, query);
      const spacingWidth = Math.max(1, 32 - visibleWidth(valueText2));
      const spacing = ' '.repeat(spacingWidth);
      const descriptionStart = prefixWidth + visibleWidth(valueText2) + spacing.length;
      const remainingWidth = width - descriptionStart - 2;
      if (remainingWidth > 10) {
        const truncatedDesc = truncateToWidth(item.description, remainingWidth, '');
        const highlightedDesc = this._highlightMatch(truncatedDesc, query);
        const descText = isSelected ? highlightedDesc : this._theme.description(highlightedDesc);
        const line2 = `${prefix}${valueText2}${spacing}${descText}`;
        return isSelected ? this._theme.selectedText(line2) : line2;
      }
    }
    const maxWidth = width - prefixWidth - 2;
    const truncatedValue = truncateToWidth(displayValue, maxWidth, '');
    const valueText = this._highlightMatch(truncatedValue, query);
    const line = `${prefix}${valueText}`;
    return isSelected ? this._theme.selectedText(line) : line;
  }
  handleInput(keyData) {
    if (isKeyRelease(keyData)) {
      return;
    }
    const allowVimNav = !this._searchInput.getValue().trim();
    if (matchesKey(keyData, 'up') || matchesKey(keyData, 'ctrl+p') || allowVimNav && keyData === 'k') {
      this._selectedIndex = Math.max(0, this._selectedIndex - 1);
      this._notifySelectionChange();
      return;
    }
    if (matchesKey(keyData, 'down') || matchesKey(keyData, 'ctrl+n') || allowVimNav && keyData === 'j') {
      this._selectedIndex = Math.min(this._filteredItems.length - 1, this._selectedIndex + 1);
      this._notifySelectionChange();
      return;
    }
    if (matchesKey(keyData, 'enter')) {
      const item = this._filteredItems[this._selectedIndex];
      if (item && this.onSelect) {
        this.onSelect(item);
      }
      return;
    }
    const kb = getEditorKeybindings();
    if (kb.matches(keyData, 'selectCancel')) {
      if (this.onCancel) {
        this.onCancel();
      }
      return;
    }
    const prevValue = this._searchInput.getValue();
    this._searchInput.handleInput(keyData);
    const newValue = this._searchInput.getValue();
    if (prevValue !== newValue) {
      this._updateFilter();
    }
  }
  _notifySelectionChange() {
    const item = this._filteredItems[this._selectedIndex];
    if (item && this.onSelectionChange) {
      this.onSelectionChange(item);
    }
  }
  getSelectedItem() {
    return this._filteredItems[this._selectedIndex] ?? null;
  }
}
export {
  SearchableSelectList
};
