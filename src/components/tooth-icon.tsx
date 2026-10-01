import type { SVGProps } from "react";

export function ToothIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <g transform="translate(2 0.436)">
        <path d="M12 4c-1.8-1.4-3.9-1.9-5.7-1.1C4.1 3.7 3 5.9 3 8.4c0 2 .5 3 .9 4.6.4 1.6.9 4.3 1.2 6.3.2 1.4 1.9 1.8 2.7.6.5-.9.9-2.5 1.1-3.9.2-1.2.6-1.8 1.1-1.8s.9.6 1.1 1.8c.2 1.4.6 3 1.1 3.9.8 1.2 2.5.8 2.7-.6.3-2 .8-4.7 1.2-6.3.4-1.6.9-2.6.9-4.6 0-2.5-1.1-4.7-3.3-5.5C15.9 2.1 13.8 2.6 12 4Z" />
      </g>
    </svg>
  );
}
