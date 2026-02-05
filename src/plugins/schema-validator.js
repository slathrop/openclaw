/** @module plugins/schema-validator - JSON Schema validation for plugin configuration. */
import AjvPkg from 'ajv';
const ajv = new AjvPkg({
  allErrors: true,
  strict: false,
  removeAdditional: false
});
const schemaCache = /* @__PURE__ */ new Map();
function formatAjvErrors(errors) {
  if (!errors || errors.length === 0) {
    return ['invalid config'];
  }
  return errors.map((error) => {
    const path = error.instancePath?.replace(/^\//, '').replace(/\//g, '.') || '<root>';
    const message = error.message ?? 'invalid';
    return `${path}: ${message}`;
  });
}
function validateJsonSchemaValue(params) {
  let cached = schemaCache.get(params.cacheKey);
  if (!cached || cached.schema !== params.schema) {
    const validate = ajv.compile(params.schema);
    cached = { validate, schema: params.schema };
    schemaCache.set(params.cacheKey, cached);
  }
  const ok = cached.validate(params.value);
  if (ok) {
    return { ok: true };
  }
  return { ok: false, errors: formatAjvErrors(cached.validate.errors) };
}
export {
  validateJsonSchemaValue
};
