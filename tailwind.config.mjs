import forms from "@tailwindcss/forms";

/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}"],
    theme: {
        extend: {
            colors: {
                brand: {
                bg:    '#0A1530',
                bg2:   '#0F2347',
                accent:'#C3F35C',        // lima viva
                ink:   '#EAF2FF',        // texto principal
                mute:  'rgba(255,255,255,.72)' // texto secundario
                }
            },
            fontFamily: { sans: ['Inter','ui-sans-serif','system-ui','sans-serif'] },
            maxWidth: { container: '1200px' },
            borderRadius: { arch: '36px' },
            boxShadow: {
                soft: '0 10px 30px rgba(0,0,0,.25)',
                ring: '0 0 0 1px rgba(255,255,255,.08) inset'
            }
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