import typescript from '@rollup/plugin-typescript';

export default [
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
    }
]