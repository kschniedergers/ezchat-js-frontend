import typescript from 'rollup-plugin-typescript2';

// external = ['react']

export default [
    // CommonJS (for Node)
    {
        input: ['src/index.ts', 'src/react/index.ts'],
        output: {
            dir: 'build/cjs',
            format: 'cjs',
            sourcemap: true,
            preserveModules:true,
            preserveModulesRoot: 'src',
        },
        plugins: [typescript({exclude: ['**/*.test.ts'], tsconfigOverride: {compilerOptions: {declaration: false}}})]
    },
    // ES module (for bundlers)
    {
        input: ['src/index.ts', 'src/react/index.ts'],
        output: {
            dir: 'build/esm',
            format: 'es',
            sourcemap: true,
            preserveModules: true,
            preserveModulesRoot: 'src'
        },
        plugins: [typescript({exclude: ['**/*.test.ts']})]
    },
]