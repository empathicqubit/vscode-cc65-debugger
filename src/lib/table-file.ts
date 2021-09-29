export enum LexicalType {
    SC_UNKNOWN = 0x00,
    SC_FUNC,
    SC_STRUCT,
    SC_GLOBAL,
    SC_UNION
}

export enum TableType {
    unknown = 0x00,
    symbol,
    tag,
}

export enum TableSymFlags {
    SC_NONE = 0x00,
    SC_CONST   = 0x01,
    SC_DEF     = 0x02,
    SC_REF     = 0x04,
    SC_AUTO    = 0x08,
    SC_STATIC  = 0x10,
    SC_EXTERN  = 0x20,
    SC_TYPEDEF = 0x40,
    SC_DECL    = 0x80,
    SC_FUNC    = 0x100,
    SC_STRUCTFIELD = 0x200,
    SC_PARAM = 0x400,
}

export interface TableSym {
    name: string;
    flags: TableSymFlags;
    type: string;
}

export interface LexicalScope {
    type: LexicalType;
    tableType: TableType;
    name?: string;
    syms: TableSym[];
}

export interface TableFile {
    path: string;
    scopes: LexicalScope[];
}

export function parse(path: string, text: string) : TableFile {
    const tableFile : TableFile = {
        path,
        scopes: [],
    };

    const rex =  /((SC_FUNC|SC_STRUCT|SC_UNION)\s*:\s*(\S+)\b[^\n\r]*|Global\s+(\w+)\s+table)\s+\=+\s+([\S\s]*?)[\n\r]{2,}/gim
    let match;
    let tableCount = 0;
    while(match = rex.exec(text)) {
        const type : LexicalType = LexicalType[<string>match[2]] || LexicalType.SC_GLOBAL;
        const name = match[3];
        let tableType : TableType;
        if(type == LexicalType.SC_FUNC) {
            tableType = TableType.symbol;
        }
        else if(type == LexicalType.SC_STRUCT) {
            tableType = TableType.tag;
        }
        else if(type == LexicalType.SC_UNION) {
            tableType = TableType.tag;
        }
        else {
            tableType = TableType[<string>match[4]];
        }

        const scope : LexicalScope = {
            type,
            tableType,
            syms: [],
        };

        if(name) {
            scope.name = name;
        }

        const body = match[match.length - 1];

        let itemCount = 0;
        let itemMatch : RegExpMatchArray | null;
        const entryRex = /(\w+):\s+(AsmName\s*:\s*(\S+)\s+)?Flags\s*:\s*(((SC_\w+\b|0x[0-9a-f]+)[\t ]*)+)\s+Type\s*:\s*([^\n\r]+)\s*/gim;
        while(itemMatch = entryRex.exec(body)) {
            const itemName = itemMatch[1];
            const itemFlags = itemMatch[4].split(/\s+/g).map(x => <TableSymFlags>TableSymFlags[<string>x]).filter(x => x).reduce((a, c) => a | c, TableSymFlags.SC_NONE);
            const itemType = itemMatch[itemMatch.length - 1];

            const sym : TableSym = {
                name: itemName,
                flags: itemFlags,
                type: itemType,
            };

            scope.syms.push(sym);
        }

        tableFile.scopes.push(scope);
    }

    return tableFile;
}