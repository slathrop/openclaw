const MB = 1024 * 1024;
const DEFAULT_MAX_CHARS = 500;
const DEFAULT_MAX_CHARS_BY_CAPABILITY = {
  image: DEFAULT_MAX_CHARS,
  audio: void 0,
  video: DEFAULT_MAX_CHARS
};
const DEFAULT_MAX_BYTES = {
  image: 10 * MB,
  audio: 20 * MB,
  video: 50 * MB
};
const DEFAULT_TIMEOUT_SECONDS = {
  image: 60,
  audio: 60,
  video: 120
};
const DEFAULT_PROMPT = {
  image: 'Describe the image.',
  audio: 'Transcribe the audio.',
  video: 'Describe the video.'
};
const DEFAULT_VIDEO_MAX_BASE64_BYTES = 70 * MB;
const DEFAULT_AUDIO_MODELS = {
  groq: 'whisper-large-v3-turbo',
  openai: 'gpt-4o-mini-transcribe',
  deepgram: 'nova-3'
};
const CLI_OUTPUT_MAX_BUFFER = 5 * MB;
const DEFAULT_MEDIA_CONCURRENCY = 2;
export {
  CLI_OUTPUT_MAX_BUFFER,
  DEFAULT_AUDIO_MODELS,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_CHARS,
  DEFAULT_MAX_CHARS_BY_CAPABILITY,
  DEFAULT_MEDIA_CONCURRENCY,
  DEFAULT_PROMPT,
  DEFAULT_TIMEOUT_SECONDS,
  DEFAULT_VIDEO_MAX_BASE64_BYTES
};
