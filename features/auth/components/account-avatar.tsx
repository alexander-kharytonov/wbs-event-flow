"use client";

import { Avatar } from "@mui/material";

export function AccountAvatar({
  name,
  image,
  size = 36,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  const initials = [
    parts[0],
    ...(parts.length > 1 ? [parts[parts.length - 1]] : []),
  ]
    .map((part) => Array.from(part ?? "")[0] ?? "")
    .join("")
    .toUpperCase();
  let colorHash = 0;

  for (const character of initials) {
    colorHash = (colorHash * 31 + (character.codePointAt(0) ?? 0)) % 360;
  }

  return (
    <Avatar
      src={image ?? undefined}
      alt={name}
      slotProps={{ img: { referrerPolicy: "no-referrer" } }}
      sx={{
        width: size,
        height: size,
        fontSize: (size * 14) / 36,
        fontWeight: 600,
        bgcolor: `hsl(${colorHash}, 55%, 32%)`,
        color: "#fff",
      }}
    >
      {initials}
    </Avatar>
  );
}
