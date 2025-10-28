import forms from '@tailwindcss/forms';

export default {
    content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
    safelist: [
        // fuerza su presencia en el CSS generado
        'md:grid-cols-2',
        'md:gap-14',
        'xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]'
    ],
    theme: {
        extend: {
        colors: {
            brand: { bg:'#0A1530', bg2:'#0F2347', accent:'#C3F35C', ink:'#EAF2FF', mute:'rgba(255,255,255,.72)' }
        },
        fontFamily: { sans: ['TikTok Sans','system-ui','-apple-system','BlinkMacSystemFont','Segoe UI','sans-serif'] },
        maxWidth: { container: '1200px' },
        borderRadius: { arch: '36px' },
        boxShadow: { soft: '0 10px 30px rgba(0,0,0,.25)' }
        },
        screens: { sm:'640px', md:'768px', lg:'1024px', xl:'1280px', '2xl':'1536px' }
    },
    plugins: [forms],
};