const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
import { WebClient } from '@slack/web-api';
const SLACK_DEFAULT_RETRY_OPTIONS = {
  retries: 2,
  factor: 2,
  minTimeout: 500,
  maxTimeout: 3e3,
  randomize: true
};
function resolveSlackWebClientOptions(options = {}) {
  return {
    ...options,
    retryConfig: options.retryConfig ?? SLACK_DEFAULT_RETRY_OPTIONS
  };
}
__name(resolveSlackWebClientOptions, 'resolveSlackWebClientOptions');
function createSlackWebClient(token, options = {}) {
  return new WebClient(token, resolveSlackWebClientOptions(options));
}
__name(createSlackWebClient, 'createSlackWebClient');
export {
  SLACK_DEFAULT_RETRY_OPTIONS,
  createSlackWebClient,
  resolveSlackWebClientOptions
};
