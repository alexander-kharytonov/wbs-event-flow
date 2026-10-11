import { isUiMode, type UiMode } from "@/lib/ui-mode";

// Run before body content. Unlike MUI's localStorage initializer, this uses only
// the server-resolved account/cookie preference, even when storage is blocked.
export function ThemeModeScript({ mode }: { mode: UiMode }) {
  const value = isUiMode(mode) ? mode : "system";

  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Only a validated fixed mode literal is interpolated.
      dangerouslySetInnerHTML={{
        __html: `(function () {
  var mode = ${JSON.stringify(value)};
  var dark = mode === 'dark' || (
    mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  var root = document.documentElement;
  root.removeAttribute('data-light');
  root.removeAttribute('data-dark');
  root.setAttribute(dark ? 'data-dark' : 'data-light', '');
})();`,
      }}
    />
  );
}
