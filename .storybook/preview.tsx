import type { Preview } from '@storybook/react-vite'
import '../src/client/globals.css'

const preview: Preview = {
  // Light or dark for every story, from the toolbar; the app sets the same attribute from index.html.
  globalTypes: {
    theme: {
      description: 'Light or dark mode',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  // On <html>, not around the story, so portalled menus, dialogs and tooltips take it too.
  decorators: [
    (Story, { globals }) => {
      document.documentElement.dataset.theme = globals.theme === 'dark' ? 'dark' : 'light';
      return <Story />;
    },
  ],
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