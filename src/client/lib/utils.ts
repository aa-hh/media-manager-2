import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The text-* utilities in globals.css set font, size and weight, so they belong with the font sizes, not the text colours.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'title-hero',
            'page-title',
            'section',
            'body',
            'label',
            'caption',
            'data',
            'data-small',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
