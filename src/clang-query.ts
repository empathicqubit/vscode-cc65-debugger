import * as dbgfile from './debug-file';
import * as util from 'util';
import * as child_process from 'child_process';
import * as readdir from 'recursive-readdir';
import * as path from 'path';
import * as _ from 'lodash';
import * as hotel from 'hasbin';

const execFile = util.promisify(child_process.execFile);

export interface ClangTypeInfo {
    name: string;
    type: string;
    aliasOf: string;
}

export async function getLocalTypes(dbgFile: dbgfile.Dbgfile, usePreprocess: boolean, cwd: string) : Promise<{[typename: string]:ClangTypeInfo[]}> {
    const clangExecPath : string = <any>await util.promisify((i, cb) => hotel.first(i, (result) => result ? cb(null, result) : cb(new Error('Missing'), null)))(['clang-query-10', 'clang-query-9', 'clang-query-8', 'clang-query-7', 'clang-query'])
    const baseArgs = ['-c=set output dump'];

    let codeFiles : string[];
    if(usePreprocess) {
        // FIXME Get this list from elsewhere?
        codeFiles = (await util.promisify(readdir)(cwd) as string[]).filter(x => /\.i$/gi.test(x));
    }
    else {
        codeFiles = _(dbgFile.files)
            .filter(x => /\.(c|h)$/gi.test(x.name))
            .map(x => x.name)
            .sortBy(x => !/\.h$/gi.test(x), (x, i) => i)
            .value();
    }

    // Try to find the path of CC65, in case it's nonstandard.
    let cpath = `/usr/share/cc65/include`;
    if(dbgFile.systemLib) {
        const libPath = dbgFile.systemLib.name;
        const ln = dbgFile.systemLibBaseName;

        const cc65Path = path.dirname(path.dirname(libPath));
        cpath = `${cc65Path}/include`;

        if(ln == 'apple2enh') {
            baseArgs.push('-extra-arg=-D__APPLE2__=1');
            baseArgs.push('-extra-arg=-D__APPLE2ENH__=1');
        }
        else if(ln == 'apple2') {
            baseArgs.push('-extra-arg=-D__APPLE2__=1');
        }
        else if(ln == 'atari') {
            baseArgs.push('-extra-arg=-D__ATARI__=1');
        }
        else if(ln == 'atari2600') {
            baseArgs.push('-extra-arg=-D__ATARI2600__=1');
        }
        else if(ln == 'atari5200') {
            baseArgs.push('-extra-arg=-D__ATARI5200__=1');
        }
        else if(ln == 'atarixl') {
            baseArgs.push('-extra-arg=-D__ATARI__=1');
            baseArgs.push('-extra-arg=-D__ATARIXL__=1');
        }
        else if(ln == 'atmos') {
            baseArgs.push('-extra-arg=-D__ATMOS__=1');
        }
        else if(ln == 'c128') {
            baseArgs.push('-extra-arg=-D__CBM__=1');
            baseArgs.push('-extra-arg=-D__C128__=1');
        }
        else if(ln == 'c16') {
            baseArgs.push('-extra-arg=-D__CBM__=1');
            baseArgs.push('-extra-arg=-D__C16__=1');
        }
        else if(ln == 'c64') {
            baseArgs.push('-extra-arg=-D__CBM__=1');
            baseArgs.push('-extra-arg=-D__C64__=1');
        }
        else if(ln == 'cbm510') {
            baseArgs.push('-extra-arg=-D__CBM__=1');
            baseArgs.push('-extra-arg=-D__CBM510__=1');
        }
        else if(ln == 'cbm610') {
            baseArgs.push('-extra-arg=-D__CBM__=1');
            baseArgs.push('-extra-arg=-D__CBM610__=1');
        }
        else if(ln == 'creativision') {
            baseArgs.push('-extra-arg=-D__CREATIVISION__=1');
        }
        else if(ln == 'gamate') {
            baseArgs.push('-extra-arg=-D__GAMATE__=1');
        }
        else if(ln == 'geos-apple') {
            baseArgs.push('-extra-arg=-D__GEOS__=1');
            baseArgs.push('-extra-arg=-D__GEOS_APPLE__=1');
        }
        else if(ln == 'geos-cbm') {
            baseArgs.push('-extra-arg=-D__GEOS__=1');
            baseArgs.push('-extra-arg=-D__GEOS_CBM__=1');
        }
        else if(ln == 'lynx') {
            baseArgs.push('-extra-arg=-D__LYNX__=1');
        }
        else if(ln == 'nes') {
            baseArgs.push('-extra-arg=-D__NES__=1');
        }
        else if(ln == 'osic1p') {
            baseArgs.push('-extra-arg=-D__OSI1CP__=1');
        }
        else if(ln == 'pce') {
            baseArgs.push('-extra-arg=-D__PCE__=1');
        }
        else if(ln == 'pet') {
            baseArgs.push('-extra-arg=-D__CBM__=1');
            baseArgs.push('-extra-arg=-D__PET__=1');
        }
        else if(ln == 'plus4') {
            baseArgs.push('-extra-arg=-D__CBM__=1');
            baseArgs.push('-extra-arg=-D__PLUS4__=1');
        }
        else if(ln == 'sim6502') {
            baseArgs.push('-extra-arg=-D__SIM6502__=1');
        }
        else if(ln == 'sim65c02') {
            baseArgs.push('-extra-arg=-D__SIM65C02__=1');
        }
        else if(ln == 'supervision') {
            baseArgs.push('-extra-arg=-D__SUPERVISION__=1');
        }
        else if(ln == 'telestrat') {
            baseArgs.push('-extra-arg=-D__TELESTRAT__=1');
        }
        else if(ln == 'vic20') {
            baseArgs.push('-extra-arg=-D__CBM__=1');
            baseArgs.push('-extra-arg=-D__VIC20__=1');
        }
    }

    const opts : child_process.ExecFileOptions = {
        env: {
            ...process.env,
            CPATH: cpath,
        }
    };
    const clangExec = async(args: string[]) => {
        return await execFile(clangExecPath, [...baseArgs, ...args, ...codeFiles], opts);
    }

    const varRex = /VarDecl\s+(0x[0-9a-f]+)\s+(prev\s+(0x[0-9a-f]+)\s+)?\<[^\>]+\>\s+col:([0-9]+)\s+(c|used)\s+(\w+)\s+'([^']+)'(\s+cinit|:'([\w\s]+)')?$/gim;
    const globres = await clangExec(['-c=match varDecl(isExpansionInMainFile(), hasGlobalStorage())']);
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

    const varRes = await clangExec(['-c=match functionDecl(isExpansionInMainFile(), hasDescendant(varDecl()))']);
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

    const recordRes = await clangExec(['-c=match recordDecl(isExpansionInMainFile())']);
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
