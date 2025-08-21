// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // これを追加
// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    // ↓↓↓ resolve設定を追加 ↓↓↓
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
