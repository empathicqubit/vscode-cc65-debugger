const version = (process.env.TAG_NAME || '').replace(/^v/gi, '');
const json = JSON.stringify({
    "cust_cc65-vice": {
        "download": {
            "url": "https://github.com/empathicqubit/vscode-cc65-debugger/releases/download/v${version}/cc65-vice-${version}.vsix"
        },
        "all": {
            "version": version,
            "checksum": process.env.CHECKSUM,
            "file_name": "cc65-vice.zip",
            "adapters": {
                "cust_cc65-vice": {
                    "command": [
                        "node",
                        "${gadgetDir}/cust_cc65-vice/dist/debug-adapter.js"
                    ],
                    "name": "cc65-vice"
                }
            }
        }
    }
}, null, 4)
require('fs').writeFileSync(__dirname + '/dist/gadget.json', json, 'utf8');
