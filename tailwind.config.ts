import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        "primary-dark": {
          DEFAULT: "hsl(var(--primary-dark))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        gold: {
          50: "#FFF9E6",
          100: "#FFF0BF",
          200: "#FFE799",
          300: "#FFDE73",
          400: "#F5C451",
          500: "#E5B040",
          600: "#CC9A30",
          700: "#B38425",
          800: "#996E1A",
          900: "#805810",
          950: "#4D3400",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      fontFamily: {
        sans: ["var(--font-geist)", "var(--font-inter)", "Inter", "SF Pro Display", "-apple-system", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "luxury": "0 4px 24px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(255, 255, 255, 0.03) inset",
        "luxury-lg": "0 8px 40px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 255, 255, 0.04) inset",
        "gold-glow": "0 0 40px rgba(245, 196, 81, 0.08)",
        "gold-glow-lg": "0 0 60px rgba(245, 196, 81, 0.12)",
      },
      letterSpacing: {
        "luxury": "0.08em",
        "luxury-wide": "0.15em",
      },
    },
  },
  plugins: [],
};
export default config;
