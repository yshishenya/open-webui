// if you want to generate a static html file
// for your page.
// Documentation: https://kit.svelte.dev/docs/page-options#prerender
// export const prerender = true;

// Keep the public marketing shell server-renderable so search engines and link
// previews receive the actual page copy instead of the client splash screen.
export const ssr = true;

// How to manage the trailing slashes in the URLs
// the URL for about page will be /about with 'ignore' (default)
// the URL for about page will be /about/ with 'always'
// https://kit.svelte.dev/docs/page-options#trailingslash
export const trailingSlash = 'ignore';
