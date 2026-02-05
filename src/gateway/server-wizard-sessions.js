/** @module gateway/server-wizard-sessions -- Wizard session management for guided setup flows. */
function createWizardSessionTracker() {
  const wizardSessions = /* @__PURE__ */ new Map();
  const findRunningWizard = () => {
    for (const [id, session] of wizardSessions) {
      if (session.getStatus() === 'running') {
        return id;
      }
    }
    return null;
  };
  const purgeWizardSession = (id) => {
    const session = wizardSessions.get(id);
    if (!session) {
      return;
    }
    if (session.getStatus() === 'running') {
      return;
    }
    wizardSessions.delete(id);
  };
  return { wizardSessions, findRunningWizard, purgeWizardSession };
}
export {
  createWizardSessionTracker
};
