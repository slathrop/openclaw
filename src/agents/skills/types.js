/**
 * @module skills/types
 * Skill entry, metadata, and snapshot type definitions.
 */

/**
 * @typedef {object} SkillInstallSpec
 * @property {string} [id]
 * @property {"brew" | "node" | "go" | "uv" | "download"} kind
 * @property {string} [label]
 * @property {string[]} [bins]
 * @property {string[]} [os]
 * @property {string} [formula]
 * @property {string} [package]
 * @property {string} [module]
 * @property {string} [url]
 * @property {string} [archive]
 * @property {boolean} [extract]
 * @property {number} [stripComponents]
 * @property {string} [targetDir]
 */

/**
 * @typedef {object} OpenClawSkillMetadata
 * @property {boolean} [always]
 * @property {string} [skillKey]
 * @property {string} [primaryEnv]
 * @property {string} [emoji]
 * @property {string} [homepage]
 * @property {string[]} [os]
 * @property {object} [requires]
 * @property {string[]} [requires.bins]
 * @property {string[]} [requires.anyBins]
 * @property {string[]} [requires.env]
 * @property {string[]} [requires.config]
 * @property {Array<SkillInstallSpec>} [install]
 */

/**
 * @typedef {object} SkillInvocationPolicy
 * @property {boolean} userInvocable
 * @property {boolean} disableModelInvocation
 */

/**
 * @typedef {object} SkillCommandDispatchSpec
 * @property {"tool"} kind
 * @property {string} toolName - Name of the tool to invoke.
 * @property {"raw"} [argMode] - How to forward user-provided args to the tool.
 */

/**
 * @typedef {object} SkillCommandSpec
 * @property {string} name
 * @property {string} skillName
 * @property {string} description
 * @property {SkillCommandDispatchSpec} [dispatch] - Optional deterministic dispatch behavior.
 */

/**
 * @typedef {object} SkillsInstallPreferences
 * @property {boolean} preferBrew
 * @property {"npm" | "pnpm" | "yarn" | "bun"} nodeManager
 */

/**
 * @typedef {Record<string, string>} ParsedSkillFrontmatter
 */

/**
 * @typedef {object} SkillEntry
 * @property {*} skill
 * @property {ParsedSkillFrontmatter} frontmatter
 * @property {OpenClawSkillMetadata} [metadata]
 * @property {SkillInvocationPolicy} [invocation]
 */

/**
 * @typedef {object} SkillEligibilityContext
 * @property {object} [remote]
 * @property {string[]} [remote.platforms]
 * @property {Function} [remote.hasBin]
 * @property {Function} [remote.hasAnyBin]
 * @property {string} [remote.note]
 */

/**
 * @typedef {object} SkillSnapshot
 * @property {string} prompt
 * @property {Array<{name: string, primaryEnv?: string}>} skills
 * @property {Array<*>} [resolvedSkills]
 * @property {number} [version]
 */
