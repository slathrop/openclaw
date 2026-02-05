import { resolveMatrixRoomId } from '../send.js';
import { resolveActionClient } from './client.js';
import { fetchEventSummary, readPinnedEvents } from './summary.js';
import {
  EventType
} from './types.js';
async function pinMatrixMessage(roomId, messageId, opts = {}) {
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    const current = await readPinnedEvents(client, resolvedRoom);
    const next = current.includes(messageId) ? current : [...current, messageId];
    const payload = { pinned: next };
    await client.sendStateEvent(resolvedRoom, EventType.RoomPinnedEvents, '', payload);
    return { pinned: next };
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}
async function unpinMatrixMessage(roomId, messageId, opts = {}) {
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    const current = await readPinnedEvents(client, resolvedRoom);
    const next = current.filter((id) => id !== messageId);
    const payload = { pinned: next };
    await client.sendStateEvent(resolvedRoom, EventType.RoomPinnedEvents, '', payload);
    return { pinned: next };
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}
async function listMatrixPins(roomId, opts = {}) {
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    const pinned = await readPinnedEvents(client, resolvedRoom);
    const events = (await Promise.all(
      pinned.map(async (eventId) => {
        try {
          return await fetchEventSummary(client, resolvedRoom, eventId);
        } catch {
          return null;
        }
      })
    )).filter((event) => Boolean(event));
    return { pinned, events };
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}
export {
  listMatrixPins,
  pinMatrixMessage,
  unpinMatrixMessage
};
