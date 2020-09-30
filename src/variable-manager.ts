import * as debugFile from './debug-file'
import {ViceGrip} from './vice-grip'
import * as clangQuery from './clang-query'
import * as debugUtils from './debug-utils'
import * as _ from 'lodash'

export interface VariableData {
    name : string;
    value: string;
    addr: number;
    type: string;
}

export class VariableManager {
    private _paramStackBottom?: number;
    private _paramStackTop?: number;
    private _paramStackPointer?: number;
    private _vice: ViceGrip;
    private _bssLabs: debugFile.Sym[] = [];
    private _globalLabs: debugFile.Sym[] = [];

    private _localTypes: { [typename: string]: clangQuery.ClangTypeInfo[]; } | undefined;

    constructor(vice: ViceGrip, codeSeg?: debugFile.Segment, zeroPage?: debugFile.Segment, labs?: debugFile.Sym[]) {
        this._vice = vice;
        if(zeroPage) {
            this._paramStackPointer = zeroPage.start;
        }

        if(labs && labs.length) {
            this._bssLabs = labs.filter(x => x.seg && x.seg.name == "BSS");
            this._globalLabs = labs.filter(sym => sym.name.startsWith("_") && sym.seg != codeSeg);
        }
    }

    private async _getParamStack() : Promise<Buffer> {
        await this._updateParamStack();
        if(!this._paramStackBottom || !this._paramStackTop) {
            throw new Error('Cannot find parameter stack bottom or top');
        }

        return await this._vice.getMemory(this._paramStackTop, this._paramStackBottom - this._paramStackTop)
    }

    public async preStart(buildCwd: string, dbgFile: debugFile.Dbgfile, usePreprocess: boolean) {
        await this._getLocalTypes(buildCwd, dbgFile, usePreprocess);
    }

    public async postStart() {
        await this._updateParamStack();
    }

    private async _updateParamStack() : Promise<void> {
        if(!this._paramStackPointer) {
            return;
        }

        const paramStackPos = (await this._vice.getMemory(this._paramStackPointer, 2)).readUInt16LE(0);
        if(!this._paramStackBottom) {
            this._paramStackBottom = paramStackPos;
        }

        this._paramStackTop = paramStackPos;
    }

    private async _varFromLab(sym: debugFile.Sym) : Promise<VariableData> {
        const symName = sym.name.replace(/^_/g, '')

        const buf = await this._vice.getMemory(sym.val, 2);
        const ptr = buf.readUInt16LE(0);

        let val = debugUtils.rawBufferHex(buf);

        let typename: string = '';
        let clangTypeInfo: clangQuery.ClangTypeInfo[];
        if(this._localTypes && (clangTypeInfo = this._localTypes['__GLOBAL__()'])) {
            typename = (<any>(clangTypeInfo.find(x => x.name == symName) || {})).type || '';

            if(/\bchar\s+\*/g.test(typename)) {
                const mem = await this._vice.getMemory(ptr, 24);
                const nullIndex = mem.indexOf(0x00);
                // FIXME PETSCII conversion
                const str = mem.slice(0, nullIndex === -1 ? undefined: nullIndex).toString();
                val = `${str} (${debugUtils.rawBufferHex(mem)})`;
            }

            if(!this._localTypes[typename.split(/\s+/g)[0]]) {
                typename = '';
            }
        }

        return {
            name: symName,
            value: val,
            addr: sym.val,
            type: typename
        };
    }

    private async _getLocalTypes(buildCwd: string, dbgFile: debugFile.Dbgfile, usePreprocess: boolean) {
        try {
            this._localTypes = await clangQuery.getLocalTypes(dbgFile, usePreprocess, buildCwd);
        }
        catch(e) {
            console.error(e);
            throw new Error('Not using Clang tools. Are they installed?');
        }
    }

    public async getTypeFields(addr: number, typeName: string) : Promise<VariableData[]> {
        if(!this._localTypes) {
            return [];
        }

        const arrayParts = /^([^\[]+)\[([0-9]+)\]$/gi.exec(typeName);
        let typeParts : string[];
        if(arrayParts) {
            const itemCount = parseInt(arrayParts[2]);
            const vars : VariableData[] = [];
            const itemSize = clangQuery.recurseFieldSize([{
                aliasOf: '',
                type: arrayParts[1],
                name: '',
            }], this._localTypes)[0];
            for(let i = 0; i < itemCount; i++) {
                vars.push({
                    type: arrayParts[1],
                    name: i.toString(),
                    value: arrayParts[1],
                    addr: addr + i * itemSize,
                });
            }

            return vars;
        }
        else {
            typeParts = typeName.split(/\s+/g);
        }

        let isPointer = typeParts.length > 1 && _.last(typeParts) == '*';

        if(isPointer) {
            const pointerVal = await this._vice.getMemory(addr, 2);
            addr = pointerVal.readUInt16LE(0);
        }

        const fields = this._localTypes[typeParts[0]];
        const vars : VariableData[] = [];

        const fieldSizes = clangQuery.recurseFieldSize(fields, this._localTypes);

        const totalSize = _.sum(fieldSizes);

        const mem = await this._vice.getMemory(addr, totalSize);

        let currentPosition = 0;
        for(const f in fieldSizes) {
            const fieldSize = fieldSizes[f];
            const field = fields[f];

            let typename = field.type;
            if(!this._localTypes[typename.split(/\s+/g)[0]]) {
                typename = '';
            }

            let value = '';
            if(fieldSize == 1) {
                if(field.type.startsWith('signed')) {
                    value = (<any>mem.readInt8(currentPosition).toString(16)).padStart(2, '0');
                }
                else {
                    value = (<any>mem.readUInt8(currentPosition).toString(16)).padStart(2, '0');
                }
            }
            else if(fieldSize == 2) {
                if(field.type.startsWith('signed')) {
                    value = (<any>mem.readInt16LE(currentPosition).toString(16)).padStart(4, '0');
                }
                else {
                    value = (<any>mem.readUInt16LE(currentPosition).toString(16)).padStart(4, '0');
                }
            }
            else {
                value = (<any>mem.readUInt16LE(currentPosition).toString(16)).padStart(4, '0');
            }

            vars.push({
                type: typename,
                name: field.name,
                value: "0x" + value,
                addr: addr + currentPosition,
            });

            currentPosition += fieldSize;
        }

        return vars;
    }

    public async getGlobalVariables() : Promise<VariableData[]> {
        return await Promise.all(this._globalLabs.map(x => this._varFromLab(x)));
    }

    public async getScopeVariables(currentScope?: debugFile.Scope) : Promise<any[]> {
        let stack: Buffer;
        try {
            stack = await this._getParamStack();
        }
        catch(e) {
            console.error(e);
            return [];
        }

        if(!stack.length || !currentScope || !this._paramStackTop) {
            return [];
        }

        const vars : VariableData[] = [];
        const locals = currentScope.autos;
        const mostOffset = locals[0].offs;
        for(let i = 0; i < locals.length; i++) {
            const csym = locals[i];
            const nextCsym = locals[i+1];

            const seek = -mostOffset+csym.offs;
            let seekNext = -mostOffset+csym.offs+2;
            if(nextCsym) {
                seekNext = -mostOffset+nextCsym.offs
            }

            const addr = this._paramStackTop + seek

            let ptr : number | undefined;

            let val;
            if(seekNext - seek == 2 && stack.length > seek + 1) {
                ptr = <any>stack.readUInt16LE(seek);
                val = "0x" + (<any>ptr!.toString(16)).padStart(4, '0');
            }
            else {
                val = "0x" + (<any>stack.readUInt8(seek).toString(16)).padStart(2, '0');
            }

            // FIXME Duplication with globals
            let typename: string = '';
            let clangTypeInfo: clangQuery.ClangTypeInfo[];
            if(this._localTypes && (clangTypeInfo = this._localTypes[currentScope.name + '()'])) {
                typename = (<any>(clangTypeInfo.find(x => x.name == csym.name) || {})).type || '';

                if(ptr && /\bchar\s+\*/g.test(typename)) {
                    const mem = await this._vice.getMemory(ptr, 24);
                    const nullIndex = mem.indexOf(0x00);
                    const str = mem.slice(0, nullIndex === -1 ? undefined: nullIndex).toString();
                    val = `${str} (${debugUtils.rawBufferHex(mem)})`;
                }

                if(!this._localTypes[typename.split(/\s+/g)[0]]) {
                    typename = '';
                }
            }

            vars.push({
                name: csym.name,
                value: val,
                addr: addr,
                type: typename,
            });
        }

        if(vars.length <= 1) {
            const labs = this._bssLabs.filter(x => x.scope == currentScope)
            console.log(`Total labs: ${labs.length}`);
            for(const lab of labs) {
                vars.push(await this._varFromLab(lab));
            }
        }
        else {
            console.log('We had vars');
        }

        return vars;
    }
}