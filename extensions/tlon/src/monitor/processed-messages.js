function createProcessedMessageTracker(limit = 2e3) {
  const seen = /* @__PURE__ */ new Set();
  const order = [];
  const mark = (id) => {
    const trimmed = id?.trim();
    if (!trimmed) {
      return true;
    }
    if (seen.has(trimmed)) {
      return false;
    }
    seen.add(trimmed);
    order.push(trimmed);
    if (order.length > limit) {
      const overflow = order.length - limit;
      for (let i = 0; i < overflow; i += 1) {
        const oldest = order.shift();
        if (oldest) {
          seen.delete(oldest);
        }
      }
    }
    return true;
  };
  const has = (id) => {
    const trimmed = id?.trim();
    if (!trimmed) {
      return false;
    }
    return seen.has(trimmed);
  };
  return {
    mark,
    has,
    size: () => seen.size
  };
}
export {
  createProcessedMessageTracker
};
