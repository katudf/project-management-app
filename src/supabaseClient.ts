import { createClient } from '@supabase/supabase-js'

// ▼▼ ここにSupabaseダッシュボードからコピーしたURLとキーを貼り付ける ▼▼
const supabaseUrl = 'https://quaollobtalcixmlpmps.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1YW9sbG9idGFsY2l4bWxwbXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNDM0NjUsImV4cCI6MjA2NzYxOTQ2NX0.LR1GPcwvgj1J1MrYzWMK93YS5fV2RYNl5S8tGfCYbkg'
// ▲▲ ここまで ▲▲

export const supabase = createClient(supabaseUrl, supabaseAnonKey)