import { describeImageWithModel } from '../image.js';
import { transcribeOpenAiCompatibleAudio } from './audio.js';
const openaiProvider = {
  id: 'openai',
  capabilities: ['image'],
  describeImage: describeImageWithModel,
  transcribeAudio: transcribeOpenAiCompatibleAudio
};
export {
  openaiProvider
};
