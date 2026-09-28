export function publicationState(event: {
  contentVersion: number;
  publicId?: string | null;
  publishedRevision: { contentVersion: number } | null;
}) {
  if (!event.publishedRevision) {
    return event.publicId ? "Unpublished" : "Draft";
  }

  return event.contentVersion > event.publishedRevision.contentVersion
    ? "Unpublished changes"
    : "Published";
}
