import { SelectList, SettingsList } from '@mariozechner/pi-tui';
import {
  filterableSelectListTheme,
  searchableSelectListTheme,
  selectListTheme,
  settingsListTheme
} from '../theme/theme.js';
import { FilterableSelectList } from './filterable-select-list.js';
import { SearchableSelectList } from './searchable-select-list.js';
function createSelectList(items, maxVisible = 7) {
  return new SelectList(items, maxVisible, selectListTheme);
}
function createSearchableSelectList(items, maxVisible = 7) {
  return new SearchableSelectList(items, maxVisible, searchableSelectListTheme);
}
function createFilterableSelectList(items, maxVisible = 7) {
  return new FilterableSelectList(items, maxVisible, filterableSelectListTheme);
}
function createSettingsList(items, onChange, onCancel, maxVisible = 7) {
  return new SettingsList(items, maxVisible, settingsListTheme, onChange, onCancel);
}
export {
  createFilterableSelectList,
  createSearchableSelectList,
  createSelectList,
  createSettingsList
};
