import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // エラーメッセージを少し詳しくした
  throw new Error("SupabaseのURLまたは匿名キーが設定されていません。.env ファイルを確認し、開発サーバーを再起動してください。");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)