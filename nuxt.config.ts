// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	devtools: { enabled: true },
	css: ["~/assets/css/main.css"],
	postcss: {
		plugins: {
			tailwindcss: {},
			autoprefixer: {},
		},
	},
	routeRules: {
		// Homepage pre-rendered at build time
		"/": { prerender: true },
	},
	modules: ["@nuxtjs/tailwindcss"],
});
