function buildMSTeamsMediaPayload(mediaList) {
  const first = mediaList[0];
  const mediaPaths = mediaList.map((media) => media.path);
  const mediaTypes = mediaList.map((media) => media.contentType ?? '');
  return {
    MediaPath: first?.path,
    MediaType: first?.contentType,
    MediaUrl: first?.path,
    MediaPaths: mediaPaths.length > 0 ? mediaPaths : void 0,
    MediaUrls: mediaPaths.length > 0 ? mediaPaths : void 0,
    MediaTypes: mediaPaths.length > 0 ? mediaTypes : void 0
  };
}
export {
  buildMSTeamsMediaPayload
};
