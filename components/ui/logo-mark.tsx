import { SvgIcon, type SvgIconProps } from "@mui/material";

export function LogoMark(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 16 16" {...props}>
      <path d="M0 1L16 9V15L0 7Z M10 0H16V3L12 5L6 2Z M4 11L10 14L8 16H0V14Z" />
    </SvgIcon>
  );
}
