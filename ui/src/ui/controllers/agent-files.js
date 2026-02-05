function mergeFileEntry(list, entry) {
  if (!list) {
    return list;
  }
  const hasEntry = list.files.some((file) => file.name === entry.name);
  const nextFiles = hasEntry ? list.files.map((file) => file.name === entry.name ? entry : file) : [...list.files, entry];
  return { ...list, files: nextFiles };
}
async function loadAgentFiles(state, agentId) {
  if (!state.client || !state.connected || state.agentFilesLoading) {
    return;
  }
  state.agentFilesLoading = true;
  state.agentFilesError = null;
  try {
    const res = await state.client.request('agents.files.list', {
      agentId
    });
    if (res) {
      state.agentFilesList = res;
      if (state.agentFileActive && !res.files.some((file) => file.name === state.agentFileActive)) {
        state.agentFileActive = null;
      }
    }
  } catch (err) {
    state.agentFilesError = String(err);
  } finally {
    state.agentFilesLoading = false;
  }
}
async function loadAgentFileContent(state, agentId, name, opts) {
  if (!state.client || !state.connected || state.agentFilesLoading) {
    return;
  }
  if (!opts?.force && Object.hasOwn(state.agentFileContents, name)) {
    return;
  }
  state.agentFilesLoading = true;
  state.agentFilesError = null;
  try {
    const res = await state.client.request('agents.files.get', {
      agentId,
      name
    });
    if (res?.file) {
      const content = res.file.content ?? '';
      const previousBase = state.agentFileContents[name] ?? '';
      const currentDraft = state.agentFileDrafts[name];
      const preserveDraft = opts?.preserveDraft ?? true;
      state.agentFilesList = mergeFileEntry(state.agentFilesList, res.file);
      state.agentFileContents = { ...state.agentFileContents, [name]: content };
      if (!preserveDraft || !Object.hasOwn(state.agentFileDrafts, name) || currentDraft === previousBase) {
        state.agentFileDrafts = { ...state.agentFileDrafts, [name]: content };
      }
    }
  } catch (err) {
    state.agentFilesError = String(err);
  } finally {
    state.agentFilesLoading = false;
  }
}
async function saveAgentFile(state, agentId, name, content) {
  if (!state.client || !state.connected || state.agentFileSaving) {
    return;
  }
  state.agentFileSaving = true;
  state.agentFilesError = null;
  try {
    const res = await state.client.request('agents.files.set', {
      agentId,
      name,
      content
    });
    if (res?.file) {
      state.agentFilesList = mergeFileEntry(state.agentFilesList, res.file);
      state.agentFileContents = { ...state.agentFileContents, [name]: content };
      state.agentFileDrafts = { ...state.agentFileDrafts, [name]: content };
    }
  } catch (err) {
    state.agentFilesError = String(err);
  } finally {
    state.agentFileSaving = false;
  }
}
export {
  loadAgentFileContent,
  loadAgentFiles,
  saveAgentFile
};
