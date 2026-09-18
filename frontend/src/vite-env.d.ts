/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css' {
  const content: Record<string, string>
  export default content
}

declare module '@fontsource/inter/400.css'
declare module '@fontsource/inter/500.css'
declare module '@fontsource/inter/600.css'
declare module '@fontsource/inter/700.css'
declare module '@fontsource/playfair-display/400.css'
declare module '@fontsource/playfair-display/700.css'
