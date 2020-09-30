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
    let cmd = 0x100;
    for(let cursor = 0; cursor < scope.size; cursor += opcodeSizes[cmd] || 0) {
        cmd = mem.readUInt8(cursor);
        if(instructionSpans[i].size != opcodeSizes[cmd]) {
            return false;
        }
        i++;
    }

    return true;
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
export function findStackExitsForScope(mpFile: mapFile.MapRef[], searchScope: debugFile.Scope, parentScope: debugFile.Scope, mem: Buffer, scopes: debugFile.Scope[], labs: debugFile.Sym[], codeSeg?: debugFile.Segment) : { addresses: number[], descendants: debugFile.Scope[] } {
    const addresses : number[] = [];
    const descendants : debugFile.Scope[] = [];
    const begin = searchScope.codeSpan!.absoluteAddress;
    const end = begin + searchScope.codeSpan!.size;
    const stackManipulations = mpFile.filter(x => /^[^_].*sp[0-9]?$/i.test(x.functionName));
    let cmd = 0x100;
    for(let cursor = 0; cursor < mem.length; cursor += opcodeSizes[cmd] || 0) {
        cmd = mem.readUInt8(cursor);
        if(cmd == 0x4c) { // JMP
            const addr = mem.readUInt16LE(cursor + 1);

            const builtin = stackManipulations.find(x => x.functionAddress == addr);
            if(builtin) {
                addresses.push(begin + cursor)
            }
            else if(addr < begin || addr >= end) {
                if(!(codeSeg && codeSeg.start <= addr && addr <= codeSeg.start + codeSeg.size)) {
                    continue;
                }

                let nextScope = scopes.find(x => x.spans.find(x => x.absoluteAddress == addr)) || undefined;

                if(!nextScope) {
                    const nextLabel = labs.find(x => x.val == addr && x.scope && x.scope != parentScope && x.scope != searchScope);
                    if(!nextLabel) {
                        continue;
                    }

                    nextScope = nextLabel.scope;

                    if(!nextScope) {
                        continue;
                    }
                }

                descendants.push(nextScope);
            }
        }
        else if(cmd == 0x60) { // RTS
            addresses.push(begin + cursor);
        }
    }

    return {
        addresses,
        descendants
    }
}