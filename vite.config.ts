import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// The app version comes from git tags: "v0.1.0" on a tagged commit,
// "v0.1.0-3-gabc1234" after it, with "-dirty" for uncommitted changes.
function gitVersion(): string {
  try {
    return execSync('git describe --tags --always --dirty', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(gitVersion()),
  },
});
