import typescript from '@rollup/plugin-typescript';

export default [
    // CommonJS (for Node)
    {
        input: ['src/index.ts', 'src/react/index.ts'],
        plugins: [typescript({
            declaration: false,
            rootDir: 'src',
            exclude: ['**/*.test.ts']
        })],
        output: [{
            dir: 'build/cjs',
            format: 'cjs',
            sourcemap: true,
            preserveModules: true,
            preserveModulesRoot: 'src'
        }]
    },
    // ES module (for bundlers)
    {
        input: ['src/index.ts', 'src/react/index.ts'],
        plugins: [typescript({
            declaration: true,
            declarationDir: 'build/esm',
            rootDir: 'src',
            exclude: ['**/*.test.ts']
        })],
        output: [{
            dir: 'build/esm',
            format: 'es',
            sourcemap: true,
            preserveModules: true,
            preserveModulesRoot: 'src'
        }]
    },
]