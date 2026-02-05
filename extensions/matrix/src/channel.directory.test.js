import { beforeEach, describe, expect, it } from 'vitest';
import { matrixPlugin } from './channel.js';
import { setMatrixRuntime } from './runtime.js';
describe('matrix directory', () => {
  beforeEach(() => {
    setMatrixRuntime({
      state: {
        resolveStateDir: (_env, homeDir) => homeDir()
      }
    });
  });
  it('lists peers and groups from config', async () => {
    const cfg = {
      channels: {
        matrix: {
          dm: { allowFrom: ['matrix:@alice:example.org', 'bob'] },
          groupAllowFrom: ['@dana:example.org'],
          groups: {
            '!room1:example.org': { users: ['@carol:example.org'] },
            '#alias:example.org': { users: [] }
          }
        }
      }
    };
    expect(matrixPlugin.directory).toBeTruthy();
    expect(matrixPlugin.directory?.listPeers).toBeTruthy();
    expect(matrixPlugin.directory?.listGroups).toBeTruthy();
    await expect(
      matrixPlugin.directory.listPeers({
        cfg,
        accountId: void 0,
        query: void 0,
        limit: void 0
      })
    ).resolves.toEqual(
      expect.arrayContaining([
        { kind: 'user', id: 'user:@alice:example.org' },
        { kind: 'user', id: 'bob', name: 'incomplete id; expected @user:server' },
        { kind: 'user', id: 'user:@carol:example.org' },
        { kind: 'user', id: 'user:@dana:example.org' }
      ])
    );
    await expect(
      matrixPlugin.directory.listGroups({
        cfg,
        accountId: void 0,
        query: void 0,
        limit: void 0
      })
    ).resolves.toEqual(
      expect.arrayContaining([
        { kind: 'group', id: 'room:!room1:example.org' },
        { kind: 'group', id: '#alias:example.org' }
      ])
    );
  });
});
