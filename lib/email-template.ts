import "server-only";

type EmailAction = { label: string; url: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        character
      ] ?? character
    );
  });
}

// Shared presentation for verification and application notifications.
// All content is plain text; escaping belongs to this renderer.
export function renderEmailTemplate({
  title,
  greeting,
  introduction,
  detailTitle,
  detailText,
  action,
  secondaryAction,
}: {
  title: string;
  greeting: string;
  introduction: string;
  detailTitle?: string;
  detailText?: string;
  action?: EmailAction;
  secondaryAction?: EmailAction;
}) {
  const text = [
    greeting,
    introduction,
    detailTitle,
    detailText,
    action ? `${action.label}: ${action.url}` : undefined,
    secondaryAction
      ? `${secondaryAction.label}: ${secondaryAction.url}`
      : undefined,
    "Event Flow",
  ]
    .filter((value) => value !== undefined)
    .join("\n\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f3f5f8;color:#172033;font-family:Arial,sans-serif;line-height:1.6">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#fff;border-radius:12px"><tr><td style="padding:32px">
<p style="margin:0 0 24px;color:#53647a;font-weight:bold">EVENT FLOW</p>
<h1 style="font-size:24px;line-height:1.3;margin:0 0 24px">${escapeHtml(title)}</h1>
<p>${escapeHtml(greeting)}</p><p>${escapeHtml(introduction)}</p>
${detailTitle ? `<h2 style="font-size:18px;margin-top:28px">${escapeHtml(detailTitle)}</h2>` : ""}
${detailText ? `<p style="color:#53647a">${escapeHtml(detailText)}</p>` : ""}
${action ? `<p style="margin:28px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#2459b8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px">${escapeHtml(action.label)}</a></p>` : ""}
${secondaryAction ? `<p><a href="${escapeHtml(secondaryAction.url)}">${escapeHtml(secondaryAction.label)}</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;

  return { text, html };
}
