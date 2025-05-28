// FIREBASE HELPERS

// Extract useful information from Firebase document references
export function parseDocumentReference(ref: any): { id: string; collection: string; path: string } | null {
  if (!ref?._key?.path?.segments) return null;

  const segments = ref._key.path.segments;
  const offset = ref._key.path.offset || 0;
  const len = ref._key.path.len || 2;

  // Extract the relevant path segments (collection + document)
  const relevantSegments = segments.slice(offset, offset + len);

  return {
    id: relevantSegments[1], // Document ID
    collection: relevantSegments[0], // Collection name
    path: relevantSegments.join('/') // Full path for this reference
  };
}

// Helper to process arrays of references
export function parseReferenceArray(refs: any[]): Array<{ id: string; collection: string; path: string }> {
  return refs
    .map(parseDocumentReference)
    .filter((ref): ref is NonNullable<typeof ref> => ref !== null);
}