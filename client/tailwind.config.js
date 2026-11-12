export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0E2147',          // navy
        navy: { deep: '#081A3A' },
        seal: '#F0B13A',         // gold
        sealdark: '#8A5F0C',     // gold dark enough for text on white
        mist: '#EEF2F8',
        teal: { DEFAULT: '#1C3F78', dark: '#142E5C' }, // used for primary buttons and selected states
        paper: '#F7F9FC',
      },
      fontFamily: { serif: ['Newsreader', 'Georgia', 'serif'], sans: ['"Public Sans"', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
