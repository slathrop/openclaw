import {
  Input,
  matchesKey,
  SelectList,
  getEditorKeybindings
} from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { fuzzyFilterLower, prepareSearchItems } from './fuzzy-filter.js';
class FilterableSelectList {
  _input;
  _selectList;
  _allItems;
  _maxVisible;
  _theme;
  _filterText = '';
  onSelect;
  onCancel;
  constructor(items, maxVisible, theme) {
    this._allItems = prepareSearchItems(items);
    this._maxVisible = maxVisible;
    this._theme = theme;
    this._input = new Input();
    this._selectList = new SelectList(this._allItems, maxVisible, theme);
  }
  _applyFilter() {
    const queryLower = this._filterText.toLowerCase();
    if (!queryLower.trim()) {
      this._selectList = new SelectList(this._allItems, this._maxVisible, this._theme);
      return;
    }
    const filtered = fuzzyFilterLower(this._allItems, queryLower);
    this._selectList = new SelectList(filtered, this._maxVisible, this._theme);
  }
  invalidate() {
    this._input.invalidate();
    this._selectList.invalidate();
  }
  render(width) {
    const lines = [];
    const filterLabel = this._theme.filterLabel('Filter: ');
    const inputLines = this._input.render(width - 8);
    const inputText = inputLines[0] ?? '';
    lines.push(filterLabel + inputText);
    lines.push(chalk.dim('\u2500'.repeat(Math.max(0, width))));
    const listLines = this._selectList.render(width);
    lines.push(...listLines);
    return lines;
  }
  handleInput(keyData) {
    const allowVimNav = !this._filterText.trim();
    if (matchesKey(keyData, 'up') || matchesKey(keyData, 'ctrl+p') || allowVimNav && keyData === 'k') {
      this._selectList.handleInput('\x1B[A');
      return;
    }
    if (matchesKey(keyData, 'down') || matchesKey(keyData, 'ctrl+n') || allowVimNav && keyData === 'j') {
      this._selectList.handleInput('\x1B[B');
      return;
    }
    if (matchesKey(keyData, 'enter')) {
      const selected = this._selectList.getSelectedItem();
      if (selected) {
        this.onSelect?.(selected);
      }
      return;
    }
    const kb = getEditorKeybindings();
    if (kb.matches(keyData, 'selectCancel')) {
      if (this._filterText) {
        this._filterText = '';
        this._input.setValue('');
        this._applyFilter();
      } else {
        this.onCancel?.();
      }
      return;
    }
    const prevValue = this._input.getValue();
    this._input.handleInput(keyData);
    const newValue = this._input.getValue();
    if (newValue !== prevValue) {
      this._filterText = newValue;
      this._applyFilter();
    }
  }
  getSelectedItem() {
    return this._selectList.getSelectedItem();
  }
  getFilterText() {
    return this._filterText;
  }
}
export {
  FilterableSelectList
};
