/**
 * Command execution lane identifiers for routing and concurrency control.
 * @readonly
 * @enum {string}
 */
const CommandLane = {
  Main: 'main',
  Cron: 'cron',
  Subagent: 'subagent',
  Nested: 'nested'
};

export { CommandLane };
