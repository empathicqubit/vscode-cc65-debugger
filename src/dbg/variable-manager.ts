import * as mathjs from 'mathjs';
import _flatten from 'lodash/fp/flatten';
import _sum from 'lodash/fp/sum'
import _isNaN from 'lodash/fp/isNaN';
import _max from 'lodash/fp/max'
import _set from 'lodash/fp/set';
import * as debugFile from '../lib/debug-file'
import * as debugUtils from '../lib/debug-utils'
import * as typeQuery from '../lib/type-query'
import * as tableFile from '../lib/table-file'
import { AbstractGrip } from './abstract-grip';

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
    private _emulator: AbstractGrip;
    private _staticLabs: debugFile.Sym[] = [];
    private _globalLabs: debugFile.Sym[] = [];
    private _tableFiles: tableFile.TableFile[];

    private _localTypes: { [typename: string]: typeQuery.FieldTypeInfo[]; } | undefined;

    constructor(emulator: AbstractGrip, codeSeg?: debugFile.Segment, zeroPage?: debugFile.Segment, labs?: debugFile.Sym[]) {
        this._emulator = emulator;
        if(zeroPage) {
            this._paramStackPointer = zeroPage.start;
        }

        if(labs && labs.length) {
            this._staticLabs = labs.filter(x => x.seg && (x.seg.name == "BSS" || x.seg.name == "DATA"));
            this._globalLabs = labs.filter(sym => sym.name.startsWith("_") && sym.seg != codeSeg);
        }
    }

    private async _getParamStack() : Promise<Buffer> {
        await this._updateParamStack();
        if(!this._paramStackBottom || !this._paramStackTop) {
            throw new Error('Cannot find parameter stack bottom or top');
        }

        return await this._emulator.getMemory(this._paramStackTop, this._paramStackBottom - this._paramStackTop)
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

        const paramStackPos = (await this._emulator.getMemory(this._paramStackPointer, 2)).readUInt16LE(0);
        if(!this._paramStackBottom) {
            this._paramStackBottom = paramStackPos;
        }

        this._paramStackTop = paramStackPos;
    }

    private async _renderValue(scope: string, symName: string, addr: number) : Promise<VariableData> {
        let val = '';

        const buf = await this._emulator.getMemory(addr, 2);
        const ptr = buf.readUInt16LE(0);

        let typeName = '';
        let name = symName;
        let fieldInfo: typeQuery.FieldTypeInfo[];
        if(this._localTypes && (fieldInfo = this._localTypes[scope])) {
            const field = fieldInfo.find(x => x.name == symName || x.assemblyName == symName);
            if(!field) {
                val = typeQuery.renderValue(typeQuery.parseTypeExpression('unsigned int'), buf);
                typeName = 'unsigned int';
            }
            else {
                name = field.name;
                typeName = field.type.name;

                try {
                    if(field.type.array) {
                        val = field.type.name;
                    }
                    else if(ptr && field.type.isString) {
                        const mem = await this._emulator.getMemory(ptr, 24);
                        const nullIndex = mem.indexOf(0x00);
                        const str = mem.slice(0, nullIndex === -1 ? undefined: nullIndex).toString();
                        val = typeQuery.renderValue(field.type, mem);
                    }
                    else if(field.type.isStruct || field.type.isUnion) {
                        val = typeQuery.renderValue(field.type, Buffer.alloc(0))
                    }
                    else {
                        val = typeQuery.renderValue(field.type, buf);
                    }
                }
                catch(e) {
                    val = e.toString();
                }

                if(!this._localTypes[field.type.name] && !field.type.pointer && !field.type.array) {
                    typeName = '';
                }
            }
        }

        return {
            name: name,
            value: val,
            addr: addr,
            type: typeName
        };
    }

    private async _varFromLab(sym: debugFile.Sym) : Promise<VariableData> {
        const symName = sym.name.replace(/^_/g, '')
        return this._renderValue('__GLOBAL__()', symName, sym.val);
    }

    private async _getTableFiles(buildCwd: string) : Promise<tableFile.TableFile[]> {
        if(!this._tableFiles) {
            try {
                this._tableFiles = await typeQuery.getTabFiles(buildCwd);
            }
            catch (e) {
                console.error(e);
                console.error('Problem loading tab files.');
                this._tableFiles = [];
            }
        }

        return this._tableFiles;
    }

    private async _getLocalTypes(buildCwd: string, dbgFile: debugFile.Dbgfile) {
        try {
            this._localTypes = typeQuery.getLocalTypes(dbgFile, await this._getTableFiles(buildCwd));
        }
        catch(e) {
            console.error(e);
            throw new Error('Problem loading local types.');
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
                assemblyName: '',
                type: itemType,
            }], this._localTypes)[0];
            for(let i = 0; i < type.array.length; i++) {
                const buf = await this._emulator.getMemory(addr + i * itemSize, 2);
                vars.push({
                    type: itemType.name,
                    name: i.toString(),
                    value: typeQuery.renderValue(itemType, buf),
                    addr: addr + i * itemSize,
                });
            }

            return vars;
        }

        let fields : typeQuery.FieldTypeInfo[];
        if(type.pointer) {
            const pointerVal = await this._emulator.getMemory(addr, 2);
            addr = pointerVal.readUInt16LE(0);
            fields = this._localTypes[type.pointer.baseType];
            const val = await this._emulator.getMemory(addr, 2);

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

        let totalSize : number;
        if(!type.isUnion) {
            totalSize = _sum(fieldSizes);
        }
        else {
            totalSize = _max(fieldSizes) || 0;
        }

        const mem = await this._emulator.getMemory(addr, totalSize);

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

            if(!type.isUnion) {
                currentPosition += fieldSize;
            }
        }

        return vars;
    }

    public async evaluate(exp: string, currentScope: debugFile.Scope | undefined) : Promise<VariableData> {
        const matchParts = async (parts: string[], vars: VariableData[]) : Promise<VariableData | undefined> => {
            let v : VariableData | undefined;
            for(const part of parts) {
                if(part == '.') {
                    continue;
                }

                v = vars.find(x => x.name == part);
                if(!v) {
                    break;
                }

                vars = await this.getTypeFields(v.addr, v.type);
            }

            return v;
        };

        let vars = _flatten(await Promise.all([
            this.getScopeVariables(currentScope),
            this.getGlobalVariables(),
            this.getStaticVariables(currentScope),
        ]));

        let refMatch : RegExpExecArray | null;
        let parts : string[] = [];
        let expression = exp.replace(/\s*->\s*/gi, '.');
        let lastVal : VariableData | undefined;
        const rex = /(([a-z_]\w*)|(\.))/gi;
        let scope : any = {};
        while(refMatch = rex.exec(expression)) {
            if(refMatch[2] && parts.length && /^[a-z_]\w*$/gi.test(parts[parts.length - 1])) {
                lastVal = await matchParts(parts, vars);
                let intVal = 0;
                if(lastVal && (intVal = parseInt(lastVal.value, 16)) === NaN) {
                    parts = [];
                    break;
                }

                scope = _set(parts.filter(x => x != '.'), intVal, scope);
                parts = [];
            }

            parts.push(refMatch[0]);
        }

        if(parts.length) {
            lastVal = await matchParts(parts, vars);
            let intVal = 0;
            if(lastVal && (intVal = parseInt(lastVal.value, 16)) === NaN) {
                parts = [];
            }
            else {
                scope = _set(parts.filter(x => x != '.'), intVal, scope);
            }
        }

        const res = mathjs.evaluate(expression, scope);
        let addr = 0;
        let name = '';
        let type = '';
        let val = '';
        if(lastVal) {
            addr = lastVal.addr;
            name = lastVal.name;
            type = lastVal.type;
            val = lastVal.value;
        }

        return {
            addr,
            name,
            type,
            value: !_isNaN(res) ? res.toString() : val,
        }
    }

    public async setGlobalVariable(name: string, value: number) : Promise<VariableData | undefined> {
        if(!this._localTypes) {
            return;
        }

        const field = this._localTypes['__GLOBAL__()'].find(x => x.name == name);

        if(!field || field.type.pointer || field.type.isUnion || field.type.isString || field.type.isStruct) {
            return;
        }

        const size = typeQuery.recurseFieldSize([field], this._localTypes)[0];

        const buf = Buffer.alloc(size);

        if(size == 1) {
            if(field.type.isSigned) {
                buf.writeInt8(value);
            }
            else {
                buf.writeUInt8(value);
            }
        }
        else {
            if(field.type.isSigned) {
                buf.writeInt16LE(value);
            }
            else {
                buf.writeUInt16LE(value);
            }
        }

        const currentLab = this._globalLabs.find(x => x.name == "_" + name);
        if(!currentLab) {
            return;
        }

        this._emulator.setMemory(currentLab.val, buf);

        return this._varFromLab(currentLab);
    }

    public async getGlobalVariables() : Promise<VariableData[]> {
        return await Promise.all(this._globalLabs.map(x => this._varFromLab(x)));
    }

    public async getStaticVariables(currentScope: debugFile.Scope | undefined) : Promise<VariableData[]> {
        if(!currentScope) {
            return [];
        }

        const scopeLabs = this._staticLabs.filter(x => x.scope == currentScope);

        const vars : VariableData[] = [];

        for(const scopeLab of scopeLabs) {
            vars.push(await this._renderValue(currentScope.name + '()', scopeLab.name, scopeLab.val));
        }

        return vars;
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

            // FIXME Parallelize this?
            vars.push(await this._renderValue(currentScope.name + '()', csym.name, addr));
        }

        return vars;
    }
}