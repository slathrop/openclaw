/**
 * @module pi-embedded-helpers
 * Helper utilities for embedded Pi agent session management.
 */
import {
  buildBootstrapContextFiles,
  DEFAULT_BOOTSTRAP_MAX_CHARS,
  ensureSessionHeader,
  resolveBootstrapMaxChars,
  stripThoughtSignatures
} from './pi-embedded-helpers/bootstrap.js';
import {
  BILLING_ERROR_USER_MESSAGE,
  classifyFailoverReason,
  formatRawAssistantErrorForUi,
  formatAssistantErrorText,
  getApiErrorPayloadFingerprint,
  isAuthAssistantError,
  isAuthErrorMessage,
  isBillingAssistantError,
  parseApiErrorInfo,
  sanitizeUserFacingText,
  isBillingErrorMessage,
  isCloudCodeAssistFormatError,
  isCompactionFailureError,
  isContextOverflowError,
  isLikelyContextOverflowError,
  isFailoverAssistantError,
  isFailoverErrorMessage,
  isImageDimensionErrorMessage,
  isImageSizeError,
  isOverloadedErrorMessage,
  isRawApiErrorPayload,
  isRateLimitAssistantError,
  isRateLimitErrorMessage,
  isTimeoutErrorMessage,
  parseImageDimensionError,
  parseImageSizeError
} from './pi-embedded-helpers/errors.js';
import { isGoogleModelApi, sanitizeGoogleTurnOrdering } from './pi-embedded-helpers/google.js';
import { downgradeOpenAIReasoningBlocks } from './pi-embedded-helpers/openai.js';
import {
  isEmptyAssistantMessageContent,
  sanitizeSessionMessagesImages
} from './pi-embedded-helpers/images.js';
import {
  isMessagingToolDuplicate,
  isMessagingToolDuplicateNormalized,
  normalizeTextForComparison
} from './pi-embedded-helpers/messaging-dedupe.js';
import { pickFallbackThinkingLevel } from './pi-embedded-helpers/thinking.js';
import {
  mergeConsecutiveUserTurns,
  validateAnthropicTurns,
  validateGeminiTurns
} from './pi-embedded-helpers/turns.js';
import { isValidCloudCodeAssistToolId, sanitizeToolCallId } from './tool-call-id.js';
export {
  BILLING_ERROR_USER_MESSAGE,
  DEFAULT_BOOTSTRAP_MAX_CHARS,
  buildBootstrapContextFiles,
  classifyFailoverReason,
  downgradeOpenAIReasoningBlocks,
  ensureSessionHeader,
  formatAssistantErrorText,
  formatRawAssistantErrorForUi,
  getApiErrorPayloadFingerprint,
  isAuthAssistantError,
  isAuthErrorMessage,
  isBillingAssistantError,
  isBillingErrorMessage,
  isCloudCodeAssistFormatError,
  isCompactionFailureError,
  isContextOverflowError,
  isEmptyAssistantMessageContent,
  isFailoverAssistantError,
  isFailoverErrorMessage,
  isGoogleModelApi,
  isImageDimensionErrorMessage,
  isImageSizeError,
  isLikelyContextOverflowError,
  isMessagingToolDuplicate,
  isMessagingToolDuplicateNormalized,
  isOverloadedErrorMessage,
  isRateLimitAssistantError,
  isRateLimitErrorMessage,
  isRawApiErrorPayload,
  isTimeoutErrorMessage,
  isValidCloudCodeAssistToolId,
  mergeConsecutiveUserTurns,
  normalizeTextForComparison,
  parseApiErrorInfo,
  parseImageDimensionError,
  parseImageSizeError,
  pickFallbackThinkingLevel,
  resolveBootstrapMaxChars,
  sanitizeGoogleTurnOrdering,
  sanitizeSessionMessagesImages,
  sanitizeToolCallId,
  sanitizeUserFacingText,
  stripThoughtSignatures,
  validateAnthropicTurns,
  validateGeminiTurns
};
