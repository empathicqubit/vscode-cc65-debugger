//@ts-check

'use strict';

const path = require('path');
const fs = require('fs');
const util = require('util');

const context = __dirname + '/..';
const config = async() => {
    /**@type {import('webpack').Configuration}*/
    return {
      context,
      target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
      node: {
        __dirname: false,
      },
      entry: {
        monitor: './node_modules/@entan.gl/vice-rainbow-monitor/index.js', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
      },
      output: {
        // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
        path: context + '/dist',
        filename: 'monitor.js',
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]'
      },
      devtool: 'source-map',
      externals: {
        vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/

        'spdx-exceptions': 'commonjs spdx-exceptions',
        'spdx-license-ids': 'commonjs spdx-license-ids',
        'spdx-license-ids/deprecated': 'commonjs spdx-license-ids/deprecated',
      },
      resolve: {
        modules: ['stubbed_modules', 'node_modules'],
        extensions: ['.js']
      },
      module: {
        rules: [
        {
            test: await fs.promises.realpath(path.resolve(context, "node_modules/@entan.gl/vice-rainbow-monitor/index.js")),
            use: [
            {
                loader: 'shebang-loader'
            }
            ]
        }
        ]
      }
    };
}

module.exports = config
