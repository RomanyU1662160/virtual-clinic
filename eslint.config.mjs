import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // Library scope can only depend on other library scope libraries
            { sourceTag: 'type:lib', onlyDependOnLibsWithTags: ['type:lib'] },
            // Testing scope can depend on library and other testing scope libraries
            {
              sourceTag: 'type:testing',
              onlyDependOnLibsWithTags: ['type:lib', 'type:testing'],
            },
            // Service scope can depend on library and testing scope libraries
            {
              sourceTag: 'type:service',
              onlyDependOnLibsWithTags: ['type:lib', 'type:testing'],
            },
            // Shared scope can only depend on other shared scope libraries
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
