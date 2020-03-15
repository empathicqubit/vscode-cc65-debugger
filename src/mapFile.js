"use strict";
exports.__esModule = true;
function parse(text) {
    var piece = text.split(/(Exports list by value|Imports list)/gi)[2];
    var funcrex = /\b(\w+)\s+([0-9a-f]+)\s+RLA/gi;
    var funcmatch;
    var arr = [];
    while (funcmatch = funcrex.exec(piece)) {
        arr.push({
            functionName: funcmatch[1],
            functionAddress: parseInt(funcmatch[2], 16)
        });
    }
    return arr;
}
exports.parse = parse;
