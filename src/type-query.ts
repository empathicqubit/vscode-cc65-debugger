import * as dbgfile from './debug-file';
import * as util from 'util';
import * as child_process from 'child_process';
import readdir from 'recursive-readdir';
import _sum from 'lodash/fp/sum';
import _flow from 'lodash/fp/flow';
import _filter from 'lodash/fp/filter';
import _map from 'lodash/fp/map';
import _sortBy from 'lodash/fp/sortBy';
import * as fs from 'fs';
import * as tableFile from './table-file';
import _last from 'lodash/fp/last'

const execFile = util.promisify(child_process.execFile);

export interface FieldTypeInfo {
    name: string;
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
    aliasOf: string;
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

    const maybeFunction = /^(\s*.[^\(]*?)(\s*\(.*\)\s*)?$/.exec(expression)!;
    const returnType = maybeFunction[1];
    const isFunction = !!maybeFunction[2];

    if(/^\s*\(none\)\s*$/i.test(expression)) {
        return {
            name: '',
            aliasOf,
            isUnion: false,
            isStruct: false,
            isString: false,
            isChar: false,
            isInt: false,
            isLong: false,
            isSigned: false,
        }
    }

    if(isFunction) {
        return {
            name: expression,
            aliasOf,
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
        aliasOf,
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
        const array : ArrayInfo = {
            length: parseInt(arrayParts[3]),
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
        }
    }

    return structs;
};

export function recurseFieldSize(fields: FieldTypeInfo[], allTypes: {[typename:string]:FieldTypeInfo[]}) : number[] {
    const dataSizes : number[] = [];

    for(const field of fields) {
        const realType = field.type;
        if(realType.array) {
            dataSizes.push(recurseFieldSize([{
                name: '',
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

            dataSizes.push(_sum(recurseFieldSize(type, allTypes)));
        }
    }

    return dataSizes;
}
