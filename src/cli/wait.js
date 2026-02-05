const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
function waitForever() {
  const interval = setInterval(() => {
  }, 1e6);
  interval.unref();
  return new Promise(() => {
  });
}
__name(waitForever, 'waitForever');
export {
  waitForever
};
