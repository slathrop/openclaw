import { describeImageWithModel } from '../image.js';
const minimaxProvider = {
  id: 'minimax',
  capabilities: ['image'],
  describeImage: describeImageWithModel
};
export {
  minimaxProvider
};
