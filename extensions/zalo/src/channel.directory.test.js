import { describe, expect, it } from 'vitest';
import { zaloPlugin } from './channel.js';
describe('zalo directory', () => {
  it('lists peers from allowFrom', async () => {
    const cfg = {
      channels: {
        zalo: {
          allowFrom: ['zalo:123', 'zl:234', '345']
        }
      }
    };
    expect(zaloPlugin.directory).toBeTruthy();
    expect(zaloPlugin.directory?.listPeers).toBeTruthy();
    expect(zaloPlugin.directory?.listGroups).toBeTruthy();
    await expect(
      zaloPlugin.directory.listPeers({
        cfg,
        accountId: void 0,
        query: void 0,
        limit: void 0
      })
    ).resolves.toEqual(
      expect.arrayContaining([
        { kind: 'user', id: '123' },
        { kind: 'user', id: '234' },
        { kind: 'user', id: '345' }
      ])
    );
    await expect(
      zaloPlugin.directory.listGroups({
        cfg,
        accountId: void 0,
        query: void 0,
        limit: void 0
      })
    ).resolves.toEqual([]);
  });
});
