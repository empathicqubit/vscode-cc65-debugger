import _dropWhile from 'lodash/fp/dropWhile';
import _flow from 'lodash/fp/flow';
import _max from 'lodash/fp/max';
import _reverse from 'lodash/fp/reverse';
import _takeWhile from 'lodash/fp/takeWhile';
import * as debugUtils from './debug-utils';
import * as debugFile from './debug-file';
import * as mapFile from './map-file';

export interface Instruction {
    /** The address of the instruction. Treated as a hex value if prefixed with '0x', or as a decimal value otherwise. */
    address: string;
    /** Optional raw bytes representing the instruction and its operands, in an implementation-defined format. */
    instructionBytes: string;
    /** Text representing the instruction and its operands, in an implementation-defined format. */
    instruction: string;
    filename: string;
    /** The line within the source location that corresponds to this instruction, if any. Zero-indexed */
    line: number;
}

const opcodeSizes = [
    1, 6, 1, 2, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 2, 3, 3, 3,
    3, 2, 1, 2, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3,
    1, 2, 1, 2, 2, 2, 3, 2, 1, 2, 1, 1, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, -1, 3,
    1, 2, 1, 2, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3,
    2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,
    2, 2, 1, 3, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3,
    2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3,
    2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3,
    2, 2, 2, 3, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3,
];

// http://www.oxyron.de/html/opcodes02.html
export const opcodeCycles = [
    7,  6, -1,  8,  3,  3,  5,  5,  3,  2,  2,  2,  4,  4,  6,  6,
    2,  5, -1,  8,  4,  4,  6,  6,  2,  4,  2,  7,  4,  4,  7,  7,
    6,  6, -1,  8,  3,  3,  5,  5,  4,  2,  2,  2,  4,  4,  6,  6,
    2,  5, -1,  8,  4,  4,  6,  6,  2,  4,  2,  7,  4,  4,  7,  7,
    6,  6, -1,  8,  3,  3,  5,  5,  3,  2,  2,  2,  3,  4,  6,  6,
    2,  5, -1,  8,  4,  4,  6,  6,  2,  4,  2,  7,  4,  4,  7,  7,
    6,  6, -1,  8,  3,  3,  5,  5,  4,  2,  2,  2,  5,  4,  6,  6,
    2,  5, -1,  8,  4,  4,  6,  6,  2,  4,  2,  7,  4,  4,  7,  7,
    2,  6,  2,  6,  3,  3,  3,  3,  2,  2,  2,  2,  4,  4,  4,  4,
    2,  6, -1,  6,  4,  4,  4,  4,  2,  5,  2,  5,  5,  5,  5,  5,
    2,  6,  2,  6,  3,  3,  3,  3,  2,  2,  2,  2,  4,  4,  4,  4,
    2,  5, -1,  5,  4,  4,  4,  4,  2,  4,  2,  4,  4,  4,  4,  4,
    2,  6,  2,  8,  3,  3,  5,  5,  2,  2,  2,  2,  4,  4,  6,  6,
    2,  5, -1,  8,  4,  4,  6,  6,  2,  4,  2,  7,  4,  4,  7,  7,
    2,  6,  2,  8,  3,  3,  5,  5,  2,  2,  2,  2,  4,  4,  6,  6,
    2,  5, -1,  8,  4,  4,  6,  6,  2,  4,  2,  7,  4,  4,  7,  7
]

export const opcodeNames = [
    "BRK", "ORA", "KIL", "SLO", "NOP", "ORA", "ASL", "SLO", "PHP", "ORA", "ASL", "ANC", "NOP", "ORA", "ASL", "SLO",
    "BPL", "ORA", "KIL", "SLO", "NOP", "ORA", "ASL", "SLO", "CLC", "ORA", "NOP", "SLO", "NOP", "ORA", "ASL", "SLO",
    "JSR", "AND", "KIL", "RLA", "BIT", "AND", "ROL", "RLA", "PLP", "AND", "ROL", "ANC", "BIT", "AND", "ROL", "RLA",
    "BMI", "AND", "KIL", "RLA", "NOP", "AND", "ROL", "RLA", "SEC", "AND", "NOP", "RLA", "NOP", "AND", "ROL", "RLA",
    "RTI", "EOR", "KIL", "SRE", "NOP", "EOR", "LSR", "SRE", "PHA", "EOR", "LSR", "ALR", "JMP", "EOR", "LSR", "SRE",
    "BVC", "EOR", "KIL", "SRE", "NOP", "EOR", "LSR", "SRE", "CLI", "EOR", "NOP", "SRE", "NOP", "EOR", "LSR", "SRE",
    "RTS", "ADC", "KIL", "RRA", "NOP", "ADC", "ROR", "RRA", "PLA", "ADC", "ROR", "ARR", "JMP", "ADC", "ROR", "RRA",
    "BVS", "ADC", "KIL", "RRA", "NOP", "ADC", "ROR", "RRA", "SEI", "ADC", "NOP", "RRA", "NOP", "ADC", "ROR", "RRA",
    "NOP", "STA", "NOP", "SAX", "STY", "STA", "STX", "SAX", "DEY", "NOP", "TXA", "XAA", "STY", "STA", "STX", "SAX",
    "BCC", "STA", "KIL", "AHX", "STY", "STA", "STX", "SAX", "TYA", "STA", "TXS", "TAS", "SHY", "STA", "SHX", "AHX",
    "LDY", "LDA", "LDX", "LAX", "LDY", "LDA", "LDX", "LAX", "TAY", "LDA", "TAX", "LAX", "LDY", "LDA", "LDX", "LAX",
    "BCS", "LDA", "KIL", "LAX", "LDY", "LDA", "LDX", "LAX", "CLV", "LDA", "TSX", "LAS", "LDY", "LDA", "LDX", "LAX",
    "CPY", "CMP", "NOP", "DCP", "CPY", "CMP", "DEC", "DCP", "INY", "CMP", "DEX", "AXS", "CPY", "CMP", "DEC", "DCP",
    "BNE", "CMP", "KIL", "DCP", "NOP", "CMP", "DEC", "DCP", "CLD", "CMP", "NOP", "DCP", "NOP", "CMP", "DEC", "DCP",
    "CPX", "SBC", "NOP", "ISC", "CPX", "SBC", "INC", "ISC", "INX", "SBC", "NOP", "SBC", "CPX", "SBC", "INC", "ISC",
    "BEQ", "SBC", "KIL", "ISC", "NOP", "SBC", "INC", "ISC", "SED", "SBC", "NOP", "ISC", "NOP", "SBC", "INC", "ISC",
];

export const maxOpCodeSize = _max(opcodeSizes)!;

/**
 * Get the spans that are likely pointing to individual assembly instructions.
 * @param dbgFile The debug file object
 * @param scope The scope to filter
 */
export function getInstructionSpans(dbgFile: debugFile.Dbgfile, scope: debugFile.Scope) : debugFile.DebugSpan[] {
    const scopeSpan = scope.codeSpan;
    if(!scopeSpan) {
        return [];
    }

    const span = dbgFile.spans[0];
    const range = _flow(
        _dropWhile((x : typeof span) => x.absoluteAddress >= scopeSpan.absoluteAddress + scopeSpan.size),
        _takeWhile((x : typeof span) => x.absoluteAddress >= scopeSpan.absoluteAddress),
    )(dbgFile.spans);

    const spans = _reverse(range.filter((x, i, c) => x.size <= maxOpCodeSize && (!c[i - 1] || c[i - 1].absoluteAddress != x.absoluteAddress)))
    return spans;
}

/**
 * Verify that a block of memory matches a scope by looking at the instruction lengths.
 * @param dbgFile The debug file object
 * @param scope The scope to check
 * @param mem The memory to check. This should only be the scope data.
 */
export function verifyScope(dbgFile: debugFile.Dbgfile, scope: debugFile.Scope, mem: Buffer) : boolean {
    const instructionSpans = getInstructionSpans(dbgFile, scope);

    let i = 0;
    const nonMatch = opCodeFind(mem, (cmd, rest, pos) => {
        if(!instructionSpans[i] || instructionSpans[i].size != opcodeSizes[cmd]) {
            return true;
        }
        i++;
    });

    return !nonMatch;
}

export function opCodeFind<T>(mem: Buffer, handler: (cmd: number, rest: Buffer, index: number, name?: string) => T) : T | undefined {
    let cmd = 0x100;
    for(let cursor = 0; cursor < mem.length; cursor += opcodeSizes[cmd] || 0) {
        cmd = mem.readUInt8(cursor);
        let res : T;
        if(handler.length == 3) {
            res = handler(cmd, mem.slice(cursor + 1, cursor + opcodeSizes[cmd]), cursor);
        }
        else {
            res = handler(cmd, mem.slice(cursor + 1, cursor + opcodeSizes[cmd]), cursor, opcodeNames[cmd]);
        }
        if(res) {
            return res;
        }
    }

    return undefined;
}

interface StackChanges {
    exitAddresses: ScopeAddress[],
    jumpAddresses: ScopeAddress[],
    descendants: debugFile.Scope[],
}

export interface ScopeAddress {
    scope: debugFile.Scope,
    address: number,
}

export function findInitializationCompleteLine(mpFile: mapFile.MapRef[], dbgFile: debugFile.Dbgfile, scope: debugFile.Scope, mem: Buffer) : debugFile.SourceLine | undefined {
    const stackInitializations = mpFile.filter(x => /^(pusha.?.?|[^_](dec|sub)sp[0-9]?)$/i.test(x.functionName));
    const startAddress = scope.codeSpan?.absoluteAddress ?? -1;
    let lastFoundLine : debugFile.SourceLine | undefined;
    let currentLine : debugFile.SourceLine | undefined;
    return opCodeFind(mem, (cmd, rest, pos) => {
        const newLine = scope.codeSpan?.lines.find(x => x.span && x.span.absoluteAddress <= startAddress + pos && startAddress + pos < x.span.absoluteAddress + x.span.size);
        if(cmd == 0x4c || cmd == 0x20) { // JMP, JSR
            const addr = rest.readUInt16LE(0);
            if(stackInitializations.find(x => x.functionAddress === addr)) {
                lastFoundLine = newLine;
            }
        }

        if(currentLine && newLine != currentLine && lastFoundLine != currentLine) {
            return newLine;
        }

        currentLine = newLine;
    });
}

/**
 * Find all the places the scope would be exited
 * @param mpFile The map file object
 * @param dbgFile The debug file object
 * @param scope The scope
 * @param mem The memory of the scope
 * @param scopes All the scopes
 * @param labs All the labels
 * @param codeSeg The CODE segment
 */
export function findStackChangesForScope(mpFile: mapFile.MapRef[], searchScope: debugFile.Scope, parentScope: debugFile.Scope, mem: Buffer, scopes: debugFile.Scope[], labs: debugFile.Sym[], codeSeg?: debugFile.Segment) : StackChanges {
    const exitAddresses : ScopeAddress[] = [];
    const jumpAddresses : ScopeAddress[] = [];
    const descendants : debugFile.Scope[] = [];
    const begin = searchScope.codeSpan!.absoluteAddress;
    const end = begin + searchScope.codeSpan!.size;
    const stackManipulations = mpFile.filter(x => /^[^_].*sp[0-9]?$/i.test(x.functionName));
    opCodeFind(mem, (cmd, rest, pos) => {
        if(cmd == 0x4c) { // JMP
            const addr = rest.readUInt16LE(0);

            const builtin = stackManipulations.find(x => x.functionAddress == addr);
            if(builtin) {
                exitAddresses.push({address: begin + pos, scope: parentScope});
            }
            else if(addr < begin || addr >= end) {
                if(!(codeSeg && codeSeg.start <= addr && addr <= codeSeg.start + codeSeg.size)) {
                    return;
                }

                let nextScope = scopes.find(x => x.spans.find(x => x.absoluteAddress == addr)) || undefined;

                if(!nextScope) {
                    const nextLabel = labs.find(x => x.val == addr && x.scope && x.scope != parentScope && x.scope != searchScope);
                    if(!nextLabel) {
                        return;
                    }

                    nextScope = nextLabel.scope;

                    if(!nextScope) {
                        return;
                    }
                }

                descendants.push(nextScope);
            }
        }
        else if(cmd == 0x60) { // RTS
            exitAddresses.push({address: begin + pos, scope: parentScope});
        }
        else if(cmd == 0x20) { // JSR
            const addr = rest.readUInt16LE(0);
            const scope = scopes.find(x => x.codeSpan && x.codeSpan.absoluteAddress == addr);
            if(!scope) {
                return;
            }

            jumpAddresses.push({scope, address: begin + pos});
        }
    });

    return {
        exitAddresses,
        jumpAddresses,
        descendants,
    }
}

export function disassemble(mem: Buffer, dbgFile: debugFile.Dbgfile, mpFile: mapFile.MapRef[], startAddress: number) : Instruction[] {
    const instructions : Instruction[] = [];
    opCodeFind(mem, (cmd, rest, index, name) => {
        let restVal : number = -1;
        let restFmt = '';
        if(rest.length == 2) {
            restVal = rest.readUInt16LE(0);
            restFmt = ` \$${restVal.toString(16).padStart(4, '0')}`;
            let functionName = '';
            let map : mapFile.MapRef | undefined;
            const lab = dbgFile.labs.find(x => x.val == restVal);
            if(lab) {
                functionName = lab.name;
            }
            else if(map = mpFile.find(x => x.functionAddress == restVal)) {
                functionName = map.functionName;
            }

            if(functionName) {
                restFmt = `${restFmt.padStart(6, ' ')} ; ${functionName}`;
            }
        }
        else if (rest.length == 1) {
            restVal = rest.readUInt8(0);
            restFmt = '$' + restVal.toString(16).padStart(2, '0')
            restFmt = restFmt.padStart(6, ' ');
        }
        else {
            restFmt = restFmt.padStart(6, ' ');
        }

        const line = debugUtils.getLineFromAddress([], dbgFile, startAddress + index);
        instructions.push({
            address: (startAddress + index).toString(),
            instruction: (name || '') + restFmt,
            instructionBytes: String.fromCharCode(cmd, ...rest),
            filename: line.file?.name || '',
            line: line.num,
        });
    });

    return instructions;
}
