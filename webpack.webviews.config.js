//@ts-check

'use strict';

const path = require('path');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'web', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  entry: {
    webviews: './src/webviews.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  },
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    filename: 'webviews.js',
    libraryTarget: 'umd',
    globalObject: '(window.webviews = (window.webviews || {}))',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  resolve: {
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
            loader: 'ts-loader'
        }
        ]
    },
    ]
  }
};
module.exports = config;
