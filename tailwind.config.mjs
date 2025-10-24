import forms from "@tailwindcss/forms";

/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}"],
    theme: {
        extend: {
        colors: {
            brand: {
            bg: "#0A1530",
            bg2: "#0F2347",
            accent: "#BEF264",
            outline: "#2B3D66",
            },
        },
        fontFamily: {
            sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        },
        maxWidth: { container: "1200px" },
        borderRadius: { arch: "36px" },
        },
    },
    plugins: [forms],
};