//@ts-check

'use strict';

const path = require('path');
const context = __dirname + '/..';

/**@type {import('webpack').Configuration}*/
const config = {
  context,
  stats: {
    modules: true,
  },
  target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  cache: {
      type: 'filesystem',
  },
  node: {
    __dirname: false,
  },
  entry: {
    extension: './src/ext/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    'debug-adapter': './src/dbg/debug-adapter.ts',
  },
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: context + '/dist',
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
  },
  resolve: {
    modules: ['stubbed_modules', 'node_modules'],
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js']
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
  module: {
    rules: [
    {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
        {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            }
        }
        ]
    },
    ]
  },
};
module.exports = config;
