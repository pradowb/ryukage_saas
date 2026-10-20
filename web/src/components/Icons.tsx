import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const Icon = ({ shape, size = 18, ...p }: IconProps & { shape: ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    {shape}
  </svg>
);

export type IconComponent = (p: IconProps) => ReactNode;

export const IconReceipt: IconComponent = (p) => (
  <Icon
    {...p}
    shape={
      <>
        <path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.4V3Z" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="9" y1="12" x2="15" y2="12" />
      </>
    }
  />
);
export const IconBook: IconComponent = (p) => (
  <Icon
    {...p}
    shape={
      <>
        <path d="M4 4.5h9a2.5 2.5 0 0 1 2.5 2.5v12H7A2.5 2.5 0 0 1 4 16.5V4.5Z" />
        <line x1="4" y1="16.5" x2="15.5" y2="16.5" />
      </>
    }
  />
);
export const IconChart: IconComponent = (p) => (
  <Icon
    {...p}
    shape={
      <>
        <line x1="5" y1="18" x2="5" y2="11.5" />
        <line x1="11.5" y1="18" x2="11.5" y2="6" />
        <line x1="18" y1="18" x2="18" y2="14" />
        <line x1="3.5" y1="19.5" x2="19.5" y2="19.5" />
      </>
    }
  />
);
export const IconSettings: IconComponent = (p) => (
  <Icon
    {...p}
    shape={
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.8 6.2l-1.7 1.7M7.9 16.1l-1.7 1.7M17.8 17.8l-1.7-1.7M7.9 7.9 6.2 6.2" />
      </>
    }
  />
);
export const IconSearch: IconComponent = (p) => (
  <Icon
    {...p}
    shape={
      <>
        <circle cx="11" cy="11" r="6.5" />
        <line x1="20" y1="20" x2="15.8" y2="15.8" />
      </>
    }
  />
);
export const IconBell: IconComponent = (p) => (
  <Icon
    {...p}
    shape={
      <>
        <path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5.3 1.5 5.3H4.5S6 14.5 6 10.5Z" />
        <path d="M10 19a2.2 2.2 0 0 0 4 0" />
      </>
    }
  />
);
export const IconSun: IconComponent = (p) => (
  <Icon
    {...p}
    shape={
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6" />
      </>
    }
  />
);
export const IconMoon: IconComponent = (p) => (
  <Icon {...p} shape={<path d="M20 14.2A8.2 8.2 0 1 1 9.8 4a6.6 6.6 0 0 0 10.2 10.2Z" />} />
);
export const IconChevronDown: IconComponent = (p) => <Icon {...p} shape={<path d="M6 9l6 6 6-6" />} />;
export const IconLogOut: IconComponent = (p) => (
  <Icon
    {...p}
    shape={
      <>
        <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H9" />
        <path d="M14 16.5 19 12l-5-4.5M19 12H9" />
      </>
    }
  />
);
export const IconMenu: IconComponent = (p) => (
  <Icon
    {...p}
    shape={
      <>
        <line x1="3.5" y1="6.5" x2="20.5" y2="6.5" />
        <line x1="3.5" y1="12" x2="20.5" y2="12" />
        <line x1="3.5" y1="17.5" x2="20.5" y2="17.5" />
      </>
    }
  />
);
export const IconStore: IconComponent = (p) => (
  <Icon
    {...p}
    shape={
      <>
        <path d="M4 9.5 5.2 4h13.6L20 9.5" />
        <path d="M4 9.5a2.2 2.2 0 0 0 4.4.2 2.2 2.2 0 0 0 4.3 0 2.2 2.2 0 0 0 4.3 0 2.2 2.2 0 0 0 4.4-.2" />
        <path d="M5.5 9.8V20h13V9.8" />
        <path d="M10 20v-5.5h4V20" />
      </>
    }
  />
);
