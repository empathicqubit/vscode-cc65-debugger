import * as dbgfile from './debugFile';
import * as util from 'util';
import * as child_process from 'child_process';
import * as readdir from 'recursive-readdir';
import * as path from 'path';
import * as _ from 'lodash';
import * as hotel from 'hasbin';

export interface ClangTypeInfo {
    name: string;
    type: string;
    aliasOf: string;
}

export async function getLocalTypes(dbgFile: dbgfile.Dbgfile, usePreprocess: boolean, cwd: string) : Promise<{[typename: string]:ClangTypeInfo[]}> {
    const clangExec : string = <any>await util.promisify((i, cb) => hotel.first(i, (result) => result ? cb(null, result) : cb(new Error('Missing'), null)))(['clang-query-10', 'clang-query-9', 'clang-query-8', 'clang-query-7', 'clang-query'])
    let codeFiles : string[];

    if(usePreprocess) {
        // FIXME Get this list from elsewhere?
        codeFiles = (await util.promisify(readdir)(cwd) as string[]).filter(x => /\.i$/gi.test(x));
    }
    else {
        codeFiles = dbgFile.files.filter(x => /\.(c|h)$/gi.test(x.name)).map(x => x.name);
    }

    const varRex = /VarDecl\s+(0x[0-9a-f]+)\s+(prev\s+(0x[0-9a-f]+)\s+)?\<[^\>]+\>\s+col:([0-9]+)\s+(c|used)\s+(\w+)\s+'([^']+)'(\s+cinit|:'([\w\s]+)')?$/gim;
    const globres = await util.promisify(child_process.execFile)(clangExec, ['-c=set output dump', '-c=match varDecl(isExpansionInMainFile(), hasGlobalStorage())', ...codeFiles])
    const structs : {[typename:string]:ClangTypeInfo[]} = {};
    const globs : ClangTypeInfo[] = [];
    let globalVarMatch : RegExpExecArray | null;
    while(globalVarMatch = varRex.exec(globres.stdout)) {
        const name = globalVarMatch[6];
        const type = globalVarMatch[7].replace('struct ', '');
        const aliasOf = (globalVarMatch[9] || '').replace('struct ', '');

        globs.push({
            name,
            aliasOf,
            type
        });
    }

    structs['__GLOBAL__()'] = globs;

    const varRes = await util.promisify(child_process.execFile)(clangExec, ['-c=set output dump', '-c=match functionDecl(isExpansionInMainFile(), hasDescendant(varDecl()))', ...codeFiles])
    const functionRex = /(FunctionDecl\s+0x([0-9a-f]+)\s+\<([^\n\r]+):([0-9]+):([0-9]+),\s+[^\>]+\>\s+\S+(\s+used)?\s+(\w+)\s+'([^']+)'$)/gim;

    const functionSplit = varRes.stdout.split(functionRex);
    for(let i = 1; i < functionSplit.length ; i+=9) {
        const functionName = functionSplit[i + 6];
        const functionBody = functionSplit[i + 8];

        varRex.lastIndex = 0;
        let varMatch : RegExpExecArray | null;
        const vars : ClangTypeInfo[] = [];
        while(varMatch = varRex.exec(functionBody)) {
            const name = varMatch[6];
            const sym = dbgFile.csyms.find(x => x.sc == dbgfile.sc.auto && x.name == name && x.scope && x.scope.name == `_${functionName}`);

            if(!sym) {
                continue;
            }

            const type = varMatch[7].replace('struct ', '');
            const aliasOf = (varMatch[9] || '').replace('struct ', '');

            const varObj : ClangTypeInfo = {
                name,
                type,
                aliasOf
            }

            vars.push(varObj);
        }

        structs[`_${functionName}()`] = vars;
    }

    const recordRes = await util.promisify(child_process.execFile)(clangExec, ['-c=set output dump', '-c=match recordDecl(isExpansionInMainFile())', ...codeFiles]);
    const recordRex = /(RecordDecl\s+(0x[0-9a-f]+)\s+(prev\s+(0x[0-9a-f]+)\s+)?\<([^\n\r]+):([0-9]+):([0-9]+),\s+line:([0-9]+):([0-9]+)\>\s+line:([0-9]+):([0-9+])\s+(invalid\s+)?struct\s+(\w+\s+)?definition$)/gim;

    const recordSplit = recordRes.stdout.split(recordRex);

    for(let i = 1; i < recordSplit.length ; i+=14) {
        const fields : ClangTypeInfo[] = [];
        const recordName = (recordSplit[i + 12] || '').trim();
        if(!recordName) {
            continue; // FIXME We can't handle direct typedefs yet because they're complicated
            // Must declare as bare struct, then typedef that
        }

        const fieldRes = recordSplit[i + 13];
        const fieldRex = /FieldDecl\s+(0x[0-9a-f]+)\s+\<line:([0-9]+):([0-9]+),\s+col:([0-9]+)\>\s+col:([0-9]+)\s+(referenced\s+)?(\w+)\s+'([^']+)'(:'([\w\s]+)')?$/gim;
        let fieldMatch : RegExpExecArray | null;
        while(fieldMatch = fieldRex.exec(fieldRes)) {
            const name = fieldMatch[7];
            const type = fieldMatch[8].replace('struct ', '');
            const aliasOf = (fieldMatch[10] || '').replace('struct ', '');

            fields.push({
                name,
                type,
                aliasOf,
            })
        }

        if(!fields.length) {
            continue;
        }

        structs[recordName] = fields;
    }

    return structs;
};

export function recurseFieldSize(fields: ClangTypeInfo[], allTypes: {[typename:string]:ClangTypeInfo[]}) : number[] {
    const dataSizes : number[] = [];

    for(const field of fields) {
        const realType = field.aliasOf || field.type;
        let arrMatch : RegExpExecArray | null;
        if(arrMatch = /^([^\[]+)\[([0-9]+)\]$/gi.exec(realType)) {
            const itemCount = parseInt(arrMatch[2]);
            const itemType = arrMatch[1];
            dataSizes.push(recurseFieldSize([{
                name: '',
                type: itemType,
                aliasOf: '',
            }], allTypes)[0] * itemCount);
        }
        else if(realType.endsWith(' char')) {
            dataSizes.push(1);
        }
        else if(realType.endsWith(' int') || realType.endsWith('*')) {
            dataSizes.push(2);
        }
        else {
            const type = allTypes[realType];
            if(!type) {
                break; // We can't determine the rest of the fields if one is missing
            }

            dataSizes.push(_.sum(recurseFieldSize(type, allTypes)));
        }
    }

    return dataSizes;
}
