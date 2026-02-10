
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { execSync } from 'child_process';

const getGitHash = () => {
  // 1. 優先使用 Cloudflare Pages 提供的環境變數
  const cfHash = process.env.CF_PAGES_COMMIT_SHA;
  if (cfHash) return cfHash.substring(0, 7).toUpperCase();

  // 2. 備案：執行 git 指令
  try {
    return execSync('git rev-parse --short HEAD').toString().trim().toUpperCase();
  } catch (_e) {
    return 'V1.2-DEV';
  }
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    'import.meta.env.VITE_GIT_HASH': JSON.stringify(getGitHash())
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
