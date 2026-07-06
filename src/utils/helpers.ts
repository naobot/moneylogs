// FIREBASE HELPERS

// Internal shape of a Firestore DocumentReference's path key
interface RefLike {
  _key?: { path?: { segments: string[]; offset?: number; len?: number } };
}

// Extract useful information from Firebase document references
export function parseDocumentReference(
  ref: unknown,
): { id: string; collection: string; path: string } | null {
  const path = (ref as RefLike | null | undefined)?._key?.path;
  if (!path?.segments) return null;

  const segments = path.segments;
  const offset = path.offset || 0;
  const len = path.len || 2;

  // Extract the relevant path segments (collection + document)
  const relevantSegments = segments.slice(offset, offset + len);

  return {
    id: relevantSegments[1], // Document ID
    collection: relevantSegments[0], // Collection name
    path: relevantSegments.join("/"), // Full path for this reference
  };
}

// Helper to process arrays of references
export function parseReferenceArray(
  refs: unknown[],
): Array<{ id: string; collection: string; path: string }> {
  return refs
    .map(parseDocumentReference)
    .filter((ref): ref is NonNullable<typeof ref> => ref !== null);
}
// A logged-in user who has never saved their profile has no timezone —
// registration only collects name/email, so timezone is the setup signal.
export function needsProfileSetup(user?: { timezone?: string | null } | null): boolean {
  return !!user && !user.timezone;
}
