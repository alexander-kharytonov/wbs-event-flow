// Only root-relative paths are accepted for application navigation and callbacks.
export function safeReturnPath(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return undefined;
  }

  try {
    const decoded = decodeURIComponent(value);

    if (
      value.startsWith("//") ||
      decoded.startsWith("//") ||
      /[\\\s]/u.test(value) ||
      decoded.includes("\\") ||
      Array.from(decoded).some((character) => {
        const code = character.charCodeAt(0);

        return code < 32 || (code >= 127 && code <= 159);
      }) ||
      /%2f|%5c|%25/i.test(value.split(/[?#]/u)[0])
    ) {
      return undefined;
    }

    const url = new URL(value, "https://event-flow.invalid");

    if (
      url.origin !== "https://event-flow.invalid" ||
      url.pathname.startsWith("//")
    ) {
      return undefined;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}
