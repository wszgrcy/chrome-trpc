import * as esbuild from 'esbuild';
import * as path from 'path';
import copy from 'esbuild-plugin-copy';

async function main() {
  const testDir = path.join(process.cwd(), './test-dist');
  const options: esbuild.BuildOptions = {
    format: 'esm',
    platform: 'browser',
    sourcemap: false,
    bundle: true,
    entryPoints: [
      { in: './test/bootstrap/background.ts', out: 'background' },
      { in: './test/bootstrap/content.ts', out: 'content' },
      { in: './test/bootstrap/popup.ts', out: 'popup' },
    ],
    splitting: false,
    outdir: path.join(testDir, './clone'),
    packages: 'bundle',
    // minify: true,
    tsconfig: './test/bootstrap/tsconfig.json',
    charset: 'utf8',
    plugins: [
      copy({
        assets: [{ from: './test/bootstrap/public/clone/**/*', to: `./` }],
      }),
    ],
  };
  await esbuild.build(options);
  await esbuild.build({
    ...options,
    outdir: path.join(testDir, './no-clone'),
    plugins: [
      copy({
        assets: [{ from: './test/bootstrap/public/no-clone/**/*', to: `./` }],
      }),
    ],
  });
  await esbuild.build({
    ...options,
    outdir: path.join(testDir, './popup-to-content-script'),
    plugins: [
      copy({
        assets: [{ from: './test/bootstrap/public/no-clone/**/*', to: `./` }],
      }),
    ],
    entryPoints: [
      {
        in: './test/bootstrap/popup-to-content-script/background.ts',
        out: 'background',
      },
      {
        in: './test/bootstrap/popup-to-content-script/content.ts',
        out: 'content',
      },
      { in: './test/bootstrap/popup-to-content-script/popup.ts', out: 'popup' },
    ],
  });
  await esbuild.build({
    ...options,
    outdir: path.join(testDir, './popup-to-content-script-clone'),
    plugins: [
      copy({
        assets: [{ from: './test/bootstrap/public/clone/**/*', to: `./` }],
      }),
    ],
    entryPoints: [
      {
        in: './test/bootstrap/popup-to-content-script/background.ts',
        out: 'background',
      },
      {
        in: './test/bootstrap/popup-to-content-script/content.ts',
        out: 'content',
      },
      { in: './test/bootstrap/popup-to-content-script/popup.ts', out: 'popup' },
    ],
  });
  await esbuild.build({
    ...options,
    outdir: path.join(testDir, './content-script-to-background'),
    plugins: [
      copy({
        assets: [{ from: './test/bootstrap/public/no-clone/**/*', to: `./` }],
      }),
    ],
    entryPoints: [
      {
        in: './test/bootstrap/content-script-to-background/background.ts',
        out: 'background',
      },
      {
        in: './test/bootstrap/content-script-to-background/content.ts',
        out: 'content',
      },
      {
        in: './test/bootstrap/content-script-to-background/popup.ts',
        out: 'popup',
      },
    ],
  });
  await esbuild.build({
    ...options,
    outdir: path.join(testDir, './content-script-to-background-clone'),
    plugins: [
      copy({
        assets: [{ from: './test/bootstrap/public/clone/**/*', to: `./` }],
      }),
    ],
    entryPoints: [
      {
        in: './test/bootstrap/content-script-to-background/background.ts',
        out: 'background',
      },
      {
        in: './test/bootstrap/content-script-to-background/content.ts',
        out: 'content',
      },
      {
        in: './test/bootstrap/content-script-to-background/popup.ts',
        out: 'popup',
      },
    ],
  });
}
main();
