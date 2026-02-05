function cloneConfigObject(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}
function serializeConfigForm(form) {
  return `${JSON.stringify(form, null, 2).trimEnd()}
`;
}
function setPathValue(obj, path, value) {
  if (path.length === 0) {
    return;
  }
  let current = obj;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const nextKey = path[i + 1];
    if (typeof key === 'number') {
      if (!Array.isArray(current)) {
        return;
      }
      if (current[key] === null || current[key] === undefined) {
        current[key] = typeof nextKey === 'number' ? [] : {};
      }
      current = current[key];
    } else {
      if (typeof current !== 'object' || current === null || current === undefined) {
        return;
      }
      const record = current;
      if (record[key] === null || record[key] === undefined) {
        record[key] = typeof nextKey === 'number' ? [] : {};
      }
      current = record[key];
    }
  }
  const lastKey = path[path.length - 1];
  if (typeof lastKey === 'number') {
    if (Array.isArray(current)) {
      current[lastKey] = value;
    }
    return;
  }
  if (typeof current === 'object' && current !== null && current !== undefined) {
    current[lastKey] = value;
  }
}
function removePathValue(obj, path) {
  if (path.length === 0) {
    return;
  }
  let current = obj;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    if (typeof key === 'number') {
      if (!Array.isArray(current)) {
        return;
      }
      current = current[key];
    } else {
      if (typeof current !== 'object' || current === null || current === undefined) {
        return;
      }
      current = current[key];
    }
    if (current === null || current === undefined) {
      return;
    }
  }
  const lastKey = path[path.length - 1];
  if (typeof lastKey === 'number') {
    if (Array.isArray(current)) {
      current.splice(lastKey, 1);
    }
    return;
  }
  if (typeof current === 'object' && current !== null && current !== undefined) {
    delete current[lastKey];
  }
}
export {
  cloneConfigObject,
  removePathValue,
  serializeConfigForm,
  setPathValue
};
