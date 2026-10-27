import type { Preview } from '@storybook/react-vite'
import '../src/client/globals.css'

const preview: Preview = {
  parameters: {
    // Same sections, in the same order, as the pages of the Figma library.
    options: {
      storySort: {
        order: [
          'Icons & logos',
          'Actions & inputs',
          'Badges, marks & status',
          'Feedback & notices',
          'Rows — titles & releases',
          'Rows — activity & settings',
          'Headers & navigation',
          'Cards & posters',
          'Overlays & bars',
          'Sign in',
        ],
      },
    },

    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'error'
    }
  },
};

export default preview;