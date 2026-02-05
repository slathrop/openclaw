/**
 * @module pi-model-discovery
 * Model provider and auth storage discovery for Pi agent sessions.
 */
import { AuthStorage, ModelRegistry } from '@mariozechner/pi-coding-agent';
import path from 'node:path';
import { AuthStorage as AuthStorage2, ModelRegistry as ModelRegistry2 } from '@mariozechner/pi-coding-agent';
function discoverAuthStorage(agentDir) {
  return new AuthStorage(path.join(agentDir, 'auth.json'));
}
function discoverModels(authStorage, agentDir) {
  return new ModelRegistry(authStorage, path.join(agentDir, 'models.json'));
}
export {
  AuthStorage2 as AuthStorage,
  ModelRegistry2 as ModelRegistry,
  discoverAuthStorage,
  discoverModels
};
