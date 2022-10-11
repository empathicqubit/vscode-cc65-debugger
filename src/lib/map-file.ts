import * as fs from 'fs';
import * as path from 'path';

export interface MapRef {
    functionName: string;
    functionAddress: number;
}

export async function getMapFilePath(program?: string) : Promise<string | undefined> {
    if(!program) {
        return;
    }

    const progDir = path.dirname(program);
    const progFile = path.basename(program, path.extname(program));

    const possibles = await fs.promises.readdir(progDir);
    const filename : string | undefined = possibles
        .find(x => path.extname(x) == '.map' && path.basename(x).startsWith(progFile));

    if(!filename) {
        return;
    }

    return path.join(progDir, filename);
}

export function parse(text: string) : MapRef[] {
    const piece = text.split(/(Exports list by value|Imports list)/gi)[2];
    const funcrex = /\b(\w+)\s+([0-9a-f]+)\s[R\s]LA/gi
    let funcmatch : RegExpExecArray | null;
    let arr : MapRef[] = [];
    while(funcmatch = funcrex.exec(piece)) {
        arr.push({
            functionName: funcmatch[1],
            functionAddress: parseInt(funcmatch[2], 16),
        });
    }

    return arr;
}