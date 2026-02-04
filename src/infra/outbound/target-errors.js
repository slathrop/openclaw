/**
 * SECURITY: Standardized error messages for target resolution failures.
 * Provides consistent error formatting for missing, ambiguous, and
 * unknown target scenarios across all channels.
 * @module
 */

function missingTargetMessage(provider, hint) {
  return `Delivering to ${provider} requires target${formatTargetHint(hint)}`;
}
function missingTargetError(provider, hint) {
  return new Error(missingTargetMessage(provider, hint));
}
function ambiguousTargetMessage(provider, raw, hint) {
  return `Ambiguous target "${raw}" for ${provider}. Provide a unique name or an explicit id.${formatTargetHint(hint, true)}`;
}
function ambiguousTargetError(provider, raw, hint) {
  return new Error(ambiguousTargetMessage(provider, raw, hint));
}
function unknownTargetMessage(provider, raw, hint) {
  return `Unknown target "${raw}" for ${provider}.${formatTargetHint(hint, true)}`;
}
function unknownTargetError(provider, raw, hint) {
  return new Error(unknownTargetMessage(provider, raw, hint));
}
function formatTargetHint(hint, withLabel = false) {
  if (!hint) {
    return '';
  }
  return withLabel ? ` Hint: ${hint}` : ` ${hint}`;
}
export {
  ambiguousTargetError,
  ambiguousTargetMessage,
  missingTargetError,
  missingTargetMessage,
  unknownTargetError,
  unknownTargetMessage
};
