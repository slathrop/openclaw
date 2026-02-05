/** @module gateway/server-model-catalog -- Model catalog management for available AI providers. */
import {
  loadModelCatalog,
  resetModelCatalogCacheForTest
} from '../agents/model-catalog.js';
import { loadConfig } from '../config/config.js';
function __resetModelCatalogCacheForTest() {
  resetModelCatalogCacheForTest();
}
async function loadGatewayModelCatalog() {
  return await loadModelCatalog({ config: loadConfig() });
}
export {
  __resetModelCatalogCacheForTest,
  loadGatewayModelCatalog
};
