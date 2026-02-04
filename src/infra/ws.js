/**
 * WebSocket raw data to string conversion utility.
 *
 * Handles all WebSocket.RawData variants: string, Buffer,
 * Buffer array, and ArrayBuffer.
 */
import {Buffer} from 'node:buffer';

/**
 * Converts WebSocket raw data to a string.
 * @param {import('ws').RawData} data
 * @param {BufferEncoding} [encoding]
 * @returns {string}
 */
export function rawDataToString(data, encoding = 'utf8') {
  if (typeof data === 'string') {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString(encoding);
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString(encoding);
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString(encoding);
  }
  return Buffer.from(String(data)).toString(encoding);
}
