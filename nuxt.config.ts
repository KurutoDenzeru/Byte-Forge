// https://nuxt.com/docs/api/configuration/nuxt-config

import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
	compatibilityDate: '2025-05-15',
	devtools: { enabled: true },
	css: ['~/assets/css/tailwind.css'],

	vite: {
		plugins: [
			tailwindcss(),
		],
		build: {
			sourcemap: false // Disable sourcemaps to avoid the warning
		}
	},

	modules: ['shadcn-nuxt', 'nuxt-vitalizer'],

	shadcn: {
		/**
			* Prefix for all the imported component
			*/
		prefix: '',
		/**
			* Directory that the component lives in.
			* @default "./components/ui"
			*/
		componentDir: './components/ui'
	},

	vitalizer: {
		// Remove the render-blocking entry CSS
		disableStylesheets: 'entry',
		disablePrefetchLinks: true
	}
})