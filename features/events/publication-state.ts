export function publicationState(event: {
  contentVersion: number;
  publishedRevision: { contentVersion: number } | null;
}) {
  if (!event.publishedRevision) {
    return "Draft";
  }

  return event.contentVersion > event.publishedRevision.contentVersion
    ? "Unpublished changes"
    : "Published";
}
