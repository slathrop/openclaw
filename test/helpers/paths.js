import path from 'node:path';
function isPathWithinBase(base, target) {
  if (process.platform === 'win32') {
    const normalizedBase2 = path.win32.normalize(path.win32.resolve(base));
    const normalizedTarget2 = path.win32.normalize(path.win32.resolve(target));
    const rel2 = path.win32.relative(normalizedBase2.toLowerCase(), normalizedTarget2.toLowerCase());
    return rel2 === '' || !rel2.startsWith('..') && !path.win32.isAbsolute(rel2);
  }
  const normalizedBase = path.resolve(base);
  const normalizedTarget = path.resolve(target);
  const rel = path.relative(normalizedBase, normalizedTarget);
  return rel === '' || !rel.startsWith('..') && !path.isAbsolute(rel);
}
export {
  isPathWithinBase
};
