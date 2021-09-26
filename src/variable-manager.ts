import _sum from 'lodash/fp/sum'
import * as debugFile from './debug-file'
import * as debugUtils from './debug-utils'
import * as typeQuery from './type-query'
import { ViceGrip } from './vice-grip'

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

    private _localTypes: { [typename: string]: typeQuery.FieldTypeInfo[]; } | undefined;

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

    public async preStart(buildCwd: string, dbgFile: debugFile.Dbgfile) : Promise<debugUtils.ExtensionMessage[]> {
        try {
            await this._getLocalTypes(buildCwd, dbgFile);
        }
        catch(e) {
            return [{
                level: debugUtils.ExtensionMessageLevel.warning,
                content: e.message,
            }]
        }

        return [];
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

    private async _renderValue(scope: string, symName: string, addr: number) : Promise<VariableData> {
        let val = '';

        const buf = await this._vice.getMemory(addr, 2);
        const ptr = buf.readUInt16LE(0);

        let typeName: string = '';
        let fieldInfo: typeQuery.FieldTypeInfo[];
        if(this._localTypes && (fieldInfo = this._localTypes[scope])) {
            const field = ((fieldInfo.find(x => x.name == symName) || <typeQuery.FieldTypeInfo>{}));
            typeName = field.type.name || '';

            if(field.type.array) {
                val = typeName;
            }
            else if(ptr && field.type.isString) {
                const mem = await this._vice.getMemory(ptr, 24);
                const nullIndex = mem.indexOf(0x00);
                const str = mem.slice(0, nullIndex === -1 ? undefined: nullIndex).toString();
                val = typeQuery.renderValue(field.type, mem);
            }
            else if(field.type.isStruct) {
                val = typeQuery.renderValue(field.type, Buffer.alloc(0))
            }
            else {
                val = typeQuery.renderValue(field.type, buf);
            }

            if(!this._localTypes[typeName] && !field.type.pointer && !field.type.array) {
                typeName = '';
            }
        }

        return {
            name: symName,
            value: val,
            addr: addr,
            type: typeName
        };
    }

    private async _varFromLab(sym: debugFile.Sym) : Promise<VariableData> {
        const symName = sym.name.replace(/^_/g, '')
        return this._renderValue('__GLOBAL__()', sym.name, sym.val);
    }

    private async _getLocalTypes(buildCwd: string, dbgFile: debugFile.Dbgfile) {
        try {
            this._localTypes = typeQuery.getLocalTypes(dbgFile, await typeQuery.getTabFiles(buildCwd));
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

        const type = typeQuery.parseTypeExpression(typeName);

        if(type.array) {
            const vars : VariableData[] = [];
            const itemType = typeQuery.parseTypeExpression(type.array.itemType);
            const itemSize = typeQuery.recurseFieldSize([{
                name: '',
                type: itemType,
            }], this._localTypes)[0];
            for(let i = 0; i < type.array.length; i++) {
                vars.push({
                    type: itemType.name,
                    name: i.toString(),
                    value: itemType.name,
                    addr: addr + i * itemSize,
                });
            }

            return vars;
        }

        let fields : typeQuery.FieldTypeInfo[];
        if(type.pointer) {
            const pointerVal = await this._vice.getMemory(addr, 2);
            addr = pointerVal.readUInt16LE(0);
            fields = this._localTypes[type.pointer.baseType];
            const val = await this._vice.getMemory(addr, 2);

            if(!fields) {
                return [{
                    type: type.pointer.baseType,
                    name: type.pointer.baseType,
                    value: typeQuery.renderValue(typeQuery.parseTypeExpression(type.pointer.baseType), val),
                    addr: addr,
                }]
            }
        }
        else {
            fields = this._localTypes[type.name];
        }

        if(!fields) {
            return [];
        }

        const vars : VariableData[] = [];

        const fieldSizes = typeQuery.recurseFieldSize(fields, this._localTypes);

        const totalSize = _sum(fieldSizes);

        const mem = await this._vice.getMemory(addr, totalSize);

        let currentPosition = 0;
        for(const f in fieldSizes) {
            const fieldSize = fieldSizes[f];
            const field = fields[f];

            let typeName = field.type.name;

            let value = typeQuery.renderValue(field.type, mem.slice(currentPosition));

            if(!this._localTypes[typeName] && !field.type.array && !field.type.pointer) {
                typeName = '';
            }

            vars.push({
                type: typeName,
                name: field.name,
                value,
                addr: addr + currentPosition,
            });

            currentPosition += fieldSize;
        }

        return vars;
    }

    public async getGlobalVariables() : Promise<VariableData[]> {
        return await Promise.all(this._globalLabs.map(x => this._varFromLab(x)));
    }

    public async getScopeVariables(currentScope: debugFile.Scope | undefined) : Promise<VariableData[]> {
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

        const locals = currentScope.autos;
        if(!locals.length) {
            return [];
        }

        const vars : VariableData[] = [];
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

            vars.push(await this._renderValue(currentScope.name + '()', csym.name, addr));
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