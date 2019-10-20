const { getLoader, loaderByName, throwUnexpectedConfigError } = require('@craco/craco')

const getCracoLoaderPlugin = ({ extension, name, loaders }) => ({
  overrideWebpackConfig: ({ webpackConfig, pluginOptions = {} }) => {
    const throwError = (message, githubIssueQuery) => throwUnexpectedConfigError({
      packageName: `craco-${name}`,
      message,
      githubIssueQuery,
    })

    const newRule = {
      test: extension,
      use: loaders.map(l => ({
        loader: require.resolve(`${l}-loader`),
        options: pluginOptions[`${l}LoaderOptions`] || {},
      })),
    }

    const oneOfRule = webpackConfig.module.rules.find(rule => rule.oneOf)

    if (!oneOfRule) {
      throwError(
        'Can\'t find a \'oneOf\' rule under module.rules in the webpack config!',
        'webpack+rules+oneOf',
      )
    }

    oneOfRule.oneOf.push(newRule)
    const { isFound, match: fileLoaderMatch } = getLoader(
      webpackConfig,
      loaderByName('file-loader'),
    )

    if (!isFound) {
      throwError(
        'Can\'t find file-loader in the webpack config!',
        'webpack+file-loader',
      )
    }

    fileLoaderMatch.loader.exclude.push(extension)
    return webpackConfig
  },
})

module.exports = {
  plugins: [
    { plugin: getCracoLoaderPlugin({ name: 'stylus', extension: /\.styl$/, loaders: ['style', 'css', 'stylus'] }) },
  ],
  babel: {
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ],
  },
}
