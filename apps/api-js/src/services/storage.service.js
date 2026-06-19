export function buildStorageKey(scope, identifier, extension = "xml") {
  return `${scope}/${identifier}.${extension}`;
}
