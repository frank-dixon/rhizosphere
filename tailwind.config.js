/** Rhizosphere — cream paper shell + soil scene tokens */
module.exports = {
  content: [
    "./docs/**/*.{html,js}",
    "./src/js/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#F5F0E6",
          soft: "#FAF7F0",
          card: "#FFFCF7",
        },
        soil: {
          deep: "#1a120c",
          dark: "#2a1f16",
          mid: "#3d2e22",
          panel: "rgba(26, 18, 12, 0.88)",
        },
        umber: {
          DEFAULT: "#6b4423",
          deep: "#4a2f18",
          soft: "#8b5e3c",
        },
        ochre: {
          DEFAULT: "#c4a35a",
          bright: "#d4b86a",
          dim: "#8a7340",
        },
        root: {
          cream: "#e8dcc8",
          pale: "#f2ebe0",
          bark: "#a89070",
        },
        moss: {
          DEFAULT: "#3d5c3a",
          bright: "#5a8a52",
          deep: "#2a3f28",
        },
        clay: {
          DEFAULT: "#9c6b4a",
          warm: "#b87a52",
        },
        mist: {
          DEFAULT: "#5c5348",
          dim: "#7a7164",
        },
        ink: {
          DEFAULT: "#1C1917",
          soft: "#3D3830",
        },
        teal: {
          DEFAULT: "#0B8A8F",
          bright: "#0D9FA5",
          soft: "#E6F4F4",
          deep: "#086E72",
        },
        pathogen: {
          DEFAULT: "#8b3a3a",
          soft: "#a85050",
        },
        exudate: {
          DEFAULT: "#7a9e6e",
          glow: "rgba(122, 158, 110, 0.35)",
        },
        nfixer: {
          DEFAULT: "#4a7c59",
          bright: "#6aad7a",
        },
        amf: {
          DEFAULT: "#8b6b9e",
          soft: "#a888b8",
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        display: ['Michroma', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        brand: "0.28em",
        wide2: "0.16em",
        wide3: "0.2em",
      },
      animation: {
        "panel-in": "panel-in 0.32s cubic-bezier(0.22, 0.61, 0.36, 1)",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "exude": "exude 3.2s ease-in-out infinite",
      },
      keyframes: {
        "panel-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.7", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.06)" },
        },
        "exude": {
          "0%, 100%": { opacity: "0.45", transform: "scale(1)" },
          "50%": { opacity: "0.75", transform: "scale(1.12)" },
        },
      },
      transitionTimingFunction: {
        soil: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
