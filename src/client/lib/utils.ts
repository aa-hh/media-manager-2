import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The text-* utilities in globals.css set font, size and weight, so they belong with the font sizes, not the text colours.
// shadow-float and shadow-float-up (globals.css @theme) are shadows, so an arbitrary shadow after them replaces them.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { shadow: ['float', 'float-up'] },
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
