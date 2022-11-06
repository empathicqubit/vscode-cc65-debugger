//@ts-check

'use strict';

const path = require('path');

const context = __dirname + '/..';
/**@type {import('webpack').Configuration & { devServer: import('webpack-dev-server').Configuration }}*/
const config = {
  context,
  target: 'web', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  cache: {
      "type": "filesystem"
  },
  devServer: {
    devMiddleware: {
      publicPath: '/dist/',
    },
    allowedHosts: 'all',
    compress: true,
    port: 8794,
  },
  entry: {
    webviews: './src/webviews/index.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  },
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: context + '/dist',
    filename: 'webviews.js',
    libraryTarget: 'window',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  resolve: {
    modules: ['stubbed_modules', 'node_modules'],
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js']
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
                    },
                }
            ]
        },
    ]
  },
};
module.exports = config;
