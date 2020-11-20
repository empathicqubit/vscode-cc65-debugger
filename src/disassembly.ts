import * as debugFile from './debug-file';
import * as mapFile from './map-file';
import * as _ from 'lodash';

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

export const maxOpCodeSize = _.max(opcodeSizes)!;

/**
 * Get the spans that are likely pointing to individual assembly instructions.
 * @param dbgFile The debug file object
 * @param scope The scope to filter
 */
export function getInstructionSpans(dbgFile: debugFile.Dbgfile, scope: debugFile.Scope) : debugFile.DebugSpan[] {
    const scopeSpan = scope.spans[0];
    return _(dbgFile.spans)
        .dropWhile(x => x.absoluteAddress >= scopeSpan.absoluteAddress + scopeSpan.size)
        .filter((x, i, c) => x.size <= maxOpCodeSize && (!c[i - 1] || c[i - 1].absoluteAddress != x.absoluteAddress))
        .takeWhile(x => x.absoluteAddress >= scopeSpan.absoluteAddress)
        .reverse()
        .value();
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
        if(instructionSpans[i].size != opcodeSizes[cmd]) {
            return true;
        }
        i++;
    });

    return !nonMatch;
}

export function opCodeFind<T>(mem: Buffer, handler: (cmd: number, rest: Buffer, index: number) => T) : T | undefined {
    let cmd = 0x100;
    for(let cursor = 0; cursor < mem.length; cursor += opcodeSizes[cmd] || 0) {
        cmd = mem.readUInt8(cursor);
        const res = handler(cmd, mem.slice(cursor + 1, cursor + opcodeSizes[cmd]), cursor);
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