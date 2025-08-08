/// <reference types="vite/client" />

// ↓↓↓ この下の部分を丸ごと追加！ ↓↓↓
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}