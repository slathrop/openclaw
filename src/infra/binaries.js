/**
 * Binary dependency verification.
 *
 * Checks that required CLI tools are available on the system PATH
 * and exits with a clear error message if missing.
 */
import {runExec} from '../process/exec.js';
import {defaultRuntime} from '../runtime.js';

/**
 * Ensures a required binary is available, exiting if missing.
 * @param {string} name
 * @param {typeof runExec} [exec]
 * @param {import('../runtime.js').RuntimeEnv} [runtime]
 * @returns {Promise<void>}
 */
export async function ensureBinary(
  name,
  exec = runExec,
  runtime = defaultRuntime
) {
  // Abort early if a required CLI tool is missing.
  await exec('which', [name]).catch(() => {
    runtime.error(`Missing required binary: ${name}. Please install it.`);
    runtime.exit(1);
  });
}
