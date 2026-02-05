/** @module memory/types - Type definitions for the memory subsystem. */

/**
 * @typedef {"memory" | "sessions"} MemorySource
 */

/**
 * @typedef {object} MemorySearchResult
 * @property {string} path - File path of the matching document.
 * @property {number} startLine - Start line of the matching snippet.
 * @property {number} endLine - End line of the matching snippet.
 * @property {number} score - Relevance score.
 * @property {string} snippet - Text content of the matching region.
 * @property {MemorySource} source - Which memory source produced this result.
 * @property {string} [citation] - Optional citation reference.
 */

/**
 * @typedef {object} MemoryEmbeddingProbeResult
 * @property {boolean} ok - Whether the embedding probe succeeded.
 * @property {string} [error] - Error message if probe failed.
 */

/**
 * @typedef {object} MemorySyncProgressUpdate
 * @property {number} completed - Number of completed items.
 * @property {number} total - Total number of items.
 * @property {string} [label] - Optional progress label.
 */

/**
 * @typedef {object} MemoryProviderStatus
 * @property {"builtin" | "qmd"} backend - Memory backend type.
 * @property {string} provider - Embedding provider name.
 * @property {string} [model] - Model identifier.
 * @property {string} [requestedProvider] - Originally requested provider.
 * @property {number} [files] - Number of indexed files.
 * @property {number} [chunks] - Number of indexed chunks.
 * @property {boolean} [dirty] - Whether the index needs re-sync.
 * @property {string} [workspaceDir] - Workspace directory path.
 * @property {string} [dbPath] - Database file path.
 * @property {string[]} [extraPaths] - Additional indexed paths.
 * @property {MemorySource[]} [sources] - Active memory sources.
 * @property {Array<{source: MemorySource, files: number, chunks: number}>} [sourceCounts] - Per-source counts.
 * @property {{enabled: boolean, entries?: number, maxEntries?: number}} [cache] - Cache status.
 * @property {{enabled: boolean, available: boolean, error?: string}} [fts] - Full-text search status.
 * @property {{from: string, reason?: string}} [fallback] - Fallback provider info.
 * @property {{enabled: boolean, available?: boolean, extensionPath?: string, loadError?: string, dims?: number}} [vector] - Vector search status.
 * @property {{enabled: boolean, failures: number, limit: number, wait: boolean, concurrency: number, pollIntervalMs: number, timeoutMs: number, lastError?: string, lastProvider?: string}} [batch] - Batch processing status.
 * @property {{[key: string]: unknown}} [custom] - Custom provider-specific data.
 */

/**
 * @typedef {object} MemorySearchManager
 * @property {(query: string, opts?: {maxResults?: number, minScore?: number, sessionKey?: string}) => Promise<MemorySearchResult[]>} search - Search indexed memory.
 * @property {(params: {relPath: string, from?: number, lines?: number}) => Promise<{text: string, path: string}>} readFile - Read a file from the memory index.
 * @property {() => MemoryProviderStatus} status - Get current provider status.
 * @property {(params?: {reason?: string, force?: boolean, progress?: (update: MemorySyncProgressUpdate) => void}) => Promise<void>} [sync] - Trigger a memory sync.
 * @property {() => Promise<MemoryEmbeddingProbeResult>} probeEmbeddingAvailability - Check if embedding provider is available.
 * @property {() => Promise<boolean>} probeVectorAvailability - Check if vector search is available.
 * @property {() => Promise<void>} [close] - Close the manager and release resources.
 */
