import { transcribeDeepgramAudio } from './audio.js';
const deepgramProvider = {
  id: 'deepgram',
  capabilities: ['audio'],
  transcribeAudio: transcribeDeepgramAudio
};
export {
  deepgramProvider
};
