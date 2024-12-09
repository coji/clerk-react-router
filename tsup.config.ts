import type { Options } from 'tsup'
import { defineConfig } from 'tsup'

import { name, version } from './package.json'

export default defineConfig((overrideOptions) => {
  const isWatch = !!overrideOptions.watch

  const options: Options = {
    format: 'cjs',
    outDir: './dist',
    entry: ['./src/**/*.{ts,tsx,js,jsx}'],
    bundle: false,
    clean: true,
    minify: false,
    sourcemap: true,
    legacyOutput: true,
    dts: true,
    define: {
      PACKAGE_NAME: `"${name}"`,
      PACKAGE_VERSION: `"${version}"`,
      JS_PACKAGE_VERSION: `"1.0.0"`,
      __DEV__: `${isWatch}`,
    },
  }

  return options
})
