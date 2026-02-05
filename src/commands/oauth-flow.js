const __defProp = Object.defineProperty;
const __name = (target, value) => __defProp(target, 'name', { value, configurable: true });
// SECURITY: OAuth authorization code flow with PKCE
const validateRequiredInput = /* @__PURE__ */ __name((value) => value.trim().length > 0 ? void 0 : 'Required', 'validateRequiredInput');
function createVpsAwareOAuthHandlers(params) {
  const manualPromptMessage = params.manualPromptMessage ?? 'Paste the redirect URL (or authorization code)';
  let manualCodePromise;
  return {
    onAuth: /* @__PURE__ */ __name(async ({ url }) => {
      if (params.isRemote) {
        params.spin.stop('OAuth URL ready');
        params.runtime.log(`
Open this URL in your LOCAL browser:

${url}
`);
        manualCodePromise = params.prompter.text({
          message: manualPromptMessage,
          validate: validateRequiredInput
        }).then((value) => String(value));
        return;
      }
      params.spin.update(params.localBrowserMessage);
      await params.openUrl(url);
      params.runtime.log(`Open: ${url}`);
    }, 'onAuth'),
    onPrompt: /* @__PURE__ */ __name(async (prompt) => {
      if (manualCodePromise) {
        return manualCodePromise;
      }
      const code = await params.prompter.text({
        message: prompt.message,
        placeholder: prompt.placeholder,
        validate: validateRequiredInput
      });
      return String(code);
    }, 'onPrompt')
  };
}
__name(createVpsAwareOAuthHandlers, 'createVpsAwareOAuthHandlers');
export {
  createVpsAwareOAuthHandlers
};
