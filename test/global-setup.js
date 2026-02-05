import { installTestEnv } from './test-env';
const stdin_default = async () => {
  const { cleanup } = installTestEnv();
  return () => cleanup();
};
export {
  stdin_default as default
};
