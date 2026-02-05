const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: Interactive auth provider selection prompt
import { buildAuthChoiceGroups } from './auth-choice-options.js';
const BACK_VALUE = '__back';
async function promptAuthChoiceGrouped(params) {
  const { groups, skipOption } = buildAuthChoiceGroups(params);
  const availableGroups = groups.filter((group) => group.options.length > 0);
  while (true) {
    const providerOptions = [
      ...availableGroups.map((group2) => ({
        value: group2.value,
        label: group2.label,
        hint: group2.hint
      })),
      ...skipOption ? [skipOption] : []
    ];
    const providerSelection = await params.prompter.select({
      message: 'Model/auth provider',
      options: providerOptions
    });
    if (providerSelection === 'skip') {
      return 'skip';
    }
    const group = availableGroups.find((candidate) => candidate.value === providerSelection);
    if (!group || group.options.length === 0) {
      await params.prompter.note(
        'No auth methods available for that provider.',
        'Model/auth choice'
      );
      continue;
    }
    const methodSelection = await params.prompter.select({
      message: `${group.label} auth method`,
      options: [...group.options, { value: BACK_VALUE, label: 'Back' }]
    });
    if (methodSelection === BACK_VALUE) {
      continue;
    }
    return methodSelection;
  }
}
__name(promptAuthChoiceGrouped, 'promptAuthChoiceGrouped');
export {
  promptAuthChoiceGrouped
};
