import { describeImageWithModel } from '../image.js';
const anthropicProvider = {
  id: 'anthropic',
  capabilities: ['image'],
  describeImage: describeImageWithModel
};
export {
  anthropicProvider
};
