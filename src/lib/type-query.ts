import * as fs from 'fs';
import _last from 'lodash/fp/last';
import _sum from 'lodash/fp/sum';
import _max from 'lodash/fp/max';
import readdir from 'recursive-readdir';
import * as util from 'util';
import * as debugUtils from './debug-utils';
import * as dbgfile from './debug-file';
import * as tableFile from './table-file';

export interface FieldTypeInfo {
    name: string;
    assemblyName: string;
    type: TypeInfo;
}

export interface TypeInfo {
    name: string;
    isStruct: boolean;
    isUnion: boolean;
    isString: boolean;
    isLong: boolean;
    isInt: boolean;
    isChar: boolean;
    isSigned: boolean;
    fn?: FunctionInfo;
    pointer?: PointerInfo;
    array?: ArrayInfo;
}

export interface FunctionInfo {
    returnType: string;
}

export interface PointerInfo {
    baseType: string;
}

export interface ArrayInfo {
    length: number;
    itemType: string;
}

export async function getTabFiles(cwd: string) : Promise<tableFile.TableFile[]> {
    return await Promise.all(
        (await util.promisify(readdir)(cwd) as string[]).filter(x => /\.tab$/gi.test(x))
            .map(async tabFileName => {
                const tabFileContents = await util.promisify(fs.readFile)(tabFileName, 'utf8');
                return tableFile.parse(tabFileName, tabFileContents);
            })
    );
}

export function parseTypeExpression(expression: string) : TypeInfo {
    const aliasOf = '';

    if(!expression || /^\s*\(none\)\s*$/i.test(expression)) {
        return {
            name: '',
            isUnion: false,
            isStruct: false,
            isString: false,
            isChar: false,
            isInt: false,
            isLong: false,
            isSigned: false,
        }
    }

    const maybeFunction = /^(\s*.[^\(]*?)(\s*\(.*\)\s*)?$/.exec(expression)!;
    const returnType = maybeFunction[1];
    const isFunction = !!maybeFunction[2];

    if(isFunction) {
        return {
            name: expression,
            isUnion: false,
            isStruct: false,
            isString: false,
            isChar: false,
            isInt: false,
            isLong: false,
            isSigned: false,
            fn: {
                returnType,
            }
        };
    }

    const t : TypeInfo = {
        name: expression,
        isUnion: /^\s*union\b/g.test(expression),
        isStruct: /^\s*struct\b/g.test(expression),
        isString: /\bchar\s+\*/g.test(expression),
        isChar: /\bchar\s*$/g.test(expression),
        isInt: /\bint\s*$/g.test(expression),
        isLong: /\blong\s*$/g.test(expression),
        isSigned: /^\s*signed\b/g.test(expression),
    }

    const arrayParts = /^([^\[]+)(\[([0-9]*)\])$/gi.exec(expression);
    if(arrayParts) {
        const length = parseInt(arrayParts[3]) || 0;
        const array : ArrayInfo = {
            length: length,
            itemType: arrayParts[1],
        };

        t.array = array;
    }
    else {
        let typeParts = expression.split(/\s+/g);

        if(typeParts.length > 1 && _last(typeParts) == '*') {
            t.pointer = {
                baseType: typeParts.slice(0, -1).join(' '),
            }
        }
    }

    return t;
}

export function getLocalTypes(dbgFile: dbgfile.Dbgfile, tabFiles: tableFile.TableFile[]) : {[typename: string]:FieldTypeInfo[]} {

    if(!tabFiles.length) {
        console.log('No table files found. Extended type info may be broken.');
        return {};
    }

    const structs : {[typename:string]:FieldTypeInfo[]} = {};
    for(const tabFile of tabFiles) {
        for(const scope of tabFile.scopes) {
            const vars : FieldTypeInfo[] = [];
            for(const sym of scope.syms) {
                if(sym.name.startsWith('__') && sym.name.endsWith('__')) {
                    continue;
                }

                vars.push({
                    name: sym.name,
                    assemblyName: sym.assemblyName,
                    type: parseTypeExpression(sym.type),
                });
            }

            // Function
            if(scope.tableType == tableFile.TableType.symbol && scope.type == tableFile.LexicalType.SC_FUNC) {
                structs[`${scope.name}()`] = vars;
            }
            // Global
            else if(scope.tableType == tableFile.TableType.symbol && scope.type == tableFile.LexicalType.SC_GLOBAL) {
                structs[`__GLOBAL__()`] = vars;
            }
            // Struct
            else if(scope.tableType == tableFile.TableType.tag && scope.type == tableFile.LexicalType.SC_STRUCT) {
                structs['struct ' + scope.name || ''] = vars;
            }
            // Union
            else if(scope.tableType == tableFile.TableType.tag && scope.type == tableFile.LexicalType.SC_UNION) {
                structs['union ' + scope.name || ''] = vars;
            }
        }
    }

    return structs;
};

export function renderValue(type: TypeInfo, buf: Buffer) : string {
    if(type.isString) {
        const nullIndex = buf.indexOf(0x00);
        // FIXME PETSCII conversion
        const str = buf.slice(0, nullIndex === -1 ? undefined: nullIndex).toString();
        return `${str} (${debugUtils.rawBufferHex(buf)})`;
    }
    else if(type.isChar) {
        let val : string;
        if(type.isSigned) {
            val = buf.readInt8(0).toString(16);
        }
        else {
            val = buf.readUInt8(0).toString(16);
        }

        const num = val.replace(/^-/g, '').padStart(2, '0');
        return (val.startsWith('-') ? '-' : '') + "0x" + num;
    }
    else if(type.isInt) {
        let val : string;
        if(type.isSigned) {
            val = buf.readInt16LE(0).toString(16);
        }
        else {
            val = buf.readUInt16LE(0).toString(16);
        }

        const num = val.replace(/^-/g, '').padStart(4, '0');
        return val.startsWith('-') ? '-' : '' + "0x" + num;
    }
    else if(type.isStruct || type.isUnion) {
        return type.name;
    }
    else {
        return "0x" + (<any>buf.readUInt16LE(0).toString(16)).padStart(4, '0');
    }
}

export function recurseFieldSize(fields: FieldTypeInfo[], allTypes: {[typename:string]:FieldTypeInfo[]}) : number[] {
    const dataSizes : number[] = [];

    for(const field of fields) {
        const realType = field.type;
        if(realType.array) {
            dataSizes.push(recurseFieldSize([{
                name: '',
                assemblyName: '',
                type: parseTypeExpression(realType.array.itemType),
            }], allTypes)[0] * realType.array.length);
        }
        else if(realType.isChar) {
            dataSizes.push(1);
        }
        else if(realType.isInt || realType.pointer) {
            dataSizes.push(2);
        }
        else {
            const type = allTypes[realType.name];
            if(!type) {
                break; // We can't determine the rest of the fields if one is missing
            }

            if(!realType.isUnion) {
                dataSizes.push(_sum(recurseFieldSize(type, allTypes)));
            }
            else {
                dataSizes.push(_max(recurseFieldSize(type, allTypes)) || 0);
            }
        }
    }

    return dataSizes;
}
