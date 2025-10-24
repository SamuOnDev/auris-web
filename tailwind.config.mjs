import forms from "@tailwindcss/forms";

/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}"],
    theme: {
        extend: {
            colors: {
                brand: {
                bg: '#0A1530', bg2:'#0F2347',
                accent:'#C3F35C', ink:'#EAF2FF', mute:'rgba(255,255,255,.72)'
                }
            },
            fontFamily: { sans: ['TikTok Sans','system-ui','-apple-system','BlinkMacSystemFont','Segoe UI','sans-serif'] },
            maxWidth: { container: '1200px' },
            borderRadius: { arch: '36px' },
            boxShadow: { soft: '0 10px 30px rgba(0,0,0,.25)' }
        }
    },
    plugins: [forms],
};