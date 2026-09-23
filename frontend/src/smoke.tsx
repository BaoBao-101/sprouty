/*
 * Smoke test: render every page to a string and report the ones that throw.
 * Catches the kind of failure that otherwise shows up only as a blank page in
 * the browser, with nothing in the terminal.
 *
 *   npx vite build --ssr src/smoke.tsx --outDir .smoke && node .smoke/smoke.js
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import type { ComponentType } from 'react';

const modules = import.meta.glob<{ default: ComponentType }>('./pages/**/*.tsx', { eager: true });

let failed = 0;

for (const [file, mod] of Object.entries(modules)) {
  const Page = mod.default;
  if (typeof Page !== 'function') {
    console.log(`  ?  ${file} — khong co default export la component`);
    continue;
  }
  try {
    renderToString(
      <MemoryRouter>
        <AuthProvider>
          <CartProvider>
            <Page />
          </CartProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    console.log(`  OK ${file}`);
  } catch (err) {
    failed++;
    console.log(`  X  ${file}\n       ${(err as Error).message.split('\n')[0]}`);
  }
}

console.log(`\n${Object.keys(modules).length} trang, ${failed} loi`);
if (failed) process.exitCode = 1;
