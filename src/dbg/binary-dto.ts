import _isString from "lodash/fp/isString";

export enum ResponseType {
    unknown = -1,

    invalid = 0x00,

    memoryGet = 0x01,
    memorySet = 0x02,

    checkpointInfo = 0x11,
    checkpointDelete = 0x13,
    checkpointList = 0x14,
    checkpointToggle = 0x15,

    conditionSet = 0x22,

    registerInfo = 0x31,

    dump = 0x41,
    undump = 0x42,

    resourceGet = 0x51,
    resourceSet = 0x52,

    jam = 0x61,
    stopped = 0x62,
    resumed = 0x63,

    advanceInstructions = 0x71,
    keyboardFeed = 0x72,
    executeUntilReturn = 0x73,

    ping = 0x81,
    banksAvailable = 0x82,
    registersAvailable = 0x83,
    displayGet = 0x84,
    viceInfo = 0x85,

    paletteGet = 0x91,

    exit = 0xaa,
    quit = 0xbb,
    reset = 0xcc,
    autostart = 0xdd
}

export enum CommandType {
    invalid = 0x00,

    memoryGet = 0x01,
    memorySet = 0x02,

    checkpointGet = 0x11,
    checkpointSet = 0x12,
    checkpointDelete = 0x13,
    checkpointList = 0x14,
    checkpointToggle = 0x15,

    conditionSet = 0x22,

    registersGet = 0x31,
    registersSet = 0x32,

    dump = 0x41,
    undump = 0x42,

    resourceGet = 0x51,
    resourceSet = 0x52,

    advanceInstructions = 0x71,
    keyboardFeed = 0x72,
    executeUntilReturn = 0x73,

    ping = 0x81,
    banksAvailable = 0x82,
    registersAvailable = 0x83,
    displayGet = 0x84,
    viceInfo = 0x85,

    paletteGet = 0x91,

    exit = 0xaa,
    quit = 0xbb,
    reset = 0xcc,
    autostart = 0xdd,
}

export type Command =
    MemoryGetCommand
    | MemorySetCommand

    | CheckpointGetCommand
    | CheckpointSetCommand
    | CheckpointDeleteCommand
    | CheckpointListCommand
    | CheckpointToggleCommand

    | ConditionSetCommand

    | RegistersGetCommand
    | RegistersSetCommand

    | DumpCommand
    | UndumpCommand

    | ResourceGetCommand
    | ResourceSetCommand

    | AdvanceInstructionsCommand
    | KeyboardFeedCommand
    | ExecuteUntilReturnCommand

    | PingCommand
    | BanksAvailableCommand
    | RegistersAvailableCommand
    | DisplayGetCommand
    | ViceInfoCommand

    | PaletteGetCommand

    | ExitCommand
    | QuitCommand
    | ResetCommand
    | AutostartCommand

export type Response =
    UnknownResponse

    | MemoryGetResponse
    | MemorySetResponse

    | CheckpointInfoResponse
    | CheckpointDeleteResponse
    | CheckpointListResponse
    | CheckpointToggleResponse

    | ConditionSetResponse

    | RegisterInfoResponse

    | DumpResponse
    | UndumpResponse

    | ResourceGetResponse
    | ResourceSetResponse

    | JamResponse
    | StoppedResponse
    | ResumedResponse

    | AdvanceInstructionsResponse
    | KeyboardFeedResponse
    | ExecuteUntilReturnResponse

    | PingResponse
    | BanksAvailableResponse
    | RegistersAvailableResponse
    | DisplayGetResponse
    | ViceInfoResponse

    | PaletteGetResponse

    | ExitResponse
    | QuitResponse
    | ResetResponse
    | AutostartResponse;

interface AbstractCommand {
    type: CommandType
    /** The type of the response. If included the handler will collect
     * responses with the request ID until this type is seen. */
    responseType?: ResponseType
}

interface AbstractResponse {
    apiVersion: number;
    type: ResponseType;
    error: number;
    requestId: number;
    /** Any responses that occurred before this one which had the same request ID */
    related: Response[];
}

export interface UnknownResponse extends AbstractResponse {
    type: ResponseType.unknown;
    /** The binary body of the command, which does not include the headers */
    rawBody: Uint8Array
}

export interface RegisterCommand extends AbstractCommand {};

export interface CheckpointCommand extends AbstractCommand {};

export interface MemoryGetCommand extends AbstractCommand {
    type: CommandType.memoryGet;
    sidefx: boolean;
    startAddress: number;
    endAddress: number;
    memspace: EmulatorMemspace;
    bankId: number;
}

export interface MemoryGetResponse extends AbstractResponse {
    type: ResponseType.memoryGet;
    memory: Buffer;
}

export interface MemorySetCommand extends AbstractCommand {
    type: CommandType.memorySet;
    sidefx: boolean;
    startAddress: number;
    endAddress: number;
    memspace: EmulatorMemspace;
    bankId: number;
    memory: Buffer;
}

export interface MemorySetResponse extends AbstractResponse {
    type: ResponseType.memorySet;
}

export interface CheckpointGetCommand extends CheckpointCommand {
    type: CommandType.checkpointGet;
    id: number;
}

export interface CheckpointSetCommand extends CheckpointCommand {
    type: CommandType.checkpointSet;
    startAddress: number;
    endAddress: number;
    stop: boolean;
    enabled: boolean;
    operation: CpuOperation;
    temporary: boolean;
}

export interface CheckpointDeleteCommand extends AbstractCommand {
    type: CommandType.checkpointDelete;
    id: number;
}

export interface CheckpointDeleteResponse extends AbstractResponse {
    type: ResponseType.checkpointDelete;
}

export interface CheckpointListCommand extends AbstractCommand {
    type: CommandType.checkpointList;
}

export interface CheckpointListResponse extends AbstractResponse {
    type: ResponseType.checkpointList;
    related: CheckpointInfoResponse[];
    count: number
}


export interface CheckpointToggleCommand extends AbstractCommand {
    type: CommandType.checkpointToggle;
    id: number;
    enabled: boolean;
}

export interface CheckpointToggleResponse extends AbstractResponse {
    type: ResponseType.checkpointToggle;
}

export interface ConditionSetCommand extends AbstractCommand {
    type: CommandType.conditionSet;
    checkpointId: number;
    condition: string;
}

export interface ConditionSetResponse extends AbstractResponse {
    type: ResponseType.conditionSet;
}

export interface RegistersGetCommand extends RegisterCommand {
    type: CommandType.registersGet;
    memspace: EmulatorMemspace;
}

export interface RegistersSetCommand extends RegisterCommand {
    type: CommandType.registersSet;
    memspace: EmulatorMemspace;
    registers: SingleRegisterInfo[];
}

export interface DumpCommand extends AbstractCommand {
    type: CommandType.dump;
    saveRoms: boolean;
    saveDisks: boolean;
    filename: string;
}

export interface DumpResponse extends AbstractResponse {
    type: ResponseType.dump;
}

export interface UndumpCommand extends AbstractCommand {
    type: CommandType.undump;
    filename: string;
}

export interface UndumpResponse extends AbstractResponse {
    type: ResponseType.undump;
    programCounter: number;
}

export enum ResourceType {
    string = 0x00,
    int = 0x01,
}

export interface ResourceGetCommand extends AbstractCommand {
    type: CommandType.resourceGet;
    resourceName: string;
}

export interface ResourceGetResponse extends AbstractResponse {
    type: ResponseType.resourceGet;
    resourceType: ResourceType;
    intValue?: number;
    stringValue?: string;
}

export interface ResourceSetCommand extends AbstractCommand {
    type: CommandType.resourceSet;
    resourceType: ResourceType;
    resourceName: string;
    resourceValue: string | number;
}

export interface ResourceSetResponse extends AbstractResponse {
    type: ResponseType.resourceSet;
}

export interface AdvanceInstructionsCommand extends AbstractCommand {
    type: CommandType.advanceInstructions;
    stepOverSubroutines: boolean;
    count: number;
}

export interface AdvanceInstructionsResponse extends AbstractResponse {
    type: ResponseType.advanceInstructions;
}

export interface KeyboardFeedCommand extends AbstractCommand {
    type: CommandType.keyboardFeed;
    text: string;
}

export interface KeyboardFeedResponse extends AbstractResponse {
    type: ResponseType.keyboardFeed;
}

export interface ExecuteUntilReturnCommand extends AbstractCommand {
    type: CommandType.executeUntilReturn;
}

export interface ExecuteUntilReturnResponse extends AbstractResponse {
    type: ResponseType.executeUntilReturn;
}

export interface PingCommand extends AbstractCommand {
    type: CommandType.ping;
}

export interface PingResponse extends AbstractResponse {
    type: ResponseType.ping;
}

export interface BanksAvailableCommand extends AbstractCommand {
    type: CommandType.banksAvailable;
}

export interface BanksAvailableResponse extends AbstractResponse {
    type: ResponseType.banksAvailable;
    banks: SingleBankMeta[];
}

export interface RegistersAvailableCommand extends AbstractCommand {
    type: CommandType.registersAvailable;
    memspace: EmulatorMemspace;
}

export interface RegistersAvailableResponse extends AbstractResponse {
    type: ResponseType.registersAvailable;
    registers: SingleRegisterMeta[];
}

export enum DisplayGetFormat {
    Indexed8 = 0x00,
    RGB = 0x01,
    BGR = 0x02,
    RGBA = 0x03,
    BGRA = 0x04,
}

export interface DisplayGetCommand extends AbstractCommand {
    type: CommandType.displayGet;
    useVicII: boolean;
    format: DisplayGetFormat;
}

export interface DisplayGetResponse extends AbstractResponse {
    type: ResponseType.displayGet;
    debugWidth: number;
    debugHeight: number;
    offsetX: number;
    offsetY: number;
    innerWidth: number;
    innerHeight: number;
    bpp: number;
    rawImageData: Buffer;
}

export interface ViceInfoCommand extends AbstractCommand {
    type: CommandType.viceInfo;
}

export interface ViceInfoResponse extends AbstractResponse {
    type: ResponseType.viceInfo;
    viceVersion: number[];
    svnRevision: number;
}

export interface PaletteGetCommand extends AbstractCommand {
    type: CommandType.paletteGet
    useVicII: boolean;
}

export interface PaletteEntry {
    red: number;
    green: number;
    blue: number;
    dither: number;
}

export interface PaletteGetResponse extends AbstractResponse {
    type: ResponseType.paletteGet
    entries: PaletteEntry[]
}

export interface ExitCommand extends AbstractCommand {
    type: CommandType.exit;
}

export interface ExitResponse extends AbstractResponse {
    type: ResponseType.exit;
}

export interface QuitCommand extends AbstractCommand {
    type: CommandType.quit;
}

export interface QuitResponse extends AbstractResponse {
    type: ResponseType.quit;
}

export interface ResetCommand extends AbstractCommand {
    type: CommandType.reset;
    resetMethod: ResetMethod;
}

export enum ResetMethod {
    soft = 0x00,
    hard = 0x01,
    drive8 = 0x08,
    drive9 = 0x09,
    drive10 = 0x0a,
    drive11 = 0x0b
}

export interface ResetResponse extends AbstractResponse {
    type: ResponseType.reset;
}

export interface AutostartCommand extends AbstractCommand {
    type: CommandType.autostart;
    run: boolean;
    index: number;
    filename: string;
}

export interface AutostartResponse extends AbstractResponse {
    type: ResponseType.autostart;
}

export interface JamResponse extends AbstractResponse {
    type: ResponseType.jam;
    programCounter: number;
}

export interface StoppedResponse extends AbstractResponse {
    type: ResponseType.stopped;
    programCounter: number;
}

export interface ResumedResponse extends AbstractResponse {
    type: ResponseType.resumed;
    programCounter: number;
}

export interface RegisterInfoResponse extends AbstractResponse {
    type: ResponseType.registerInfo;
    registers: SingleRegisterInfo[];
}

export interface SingleBankMeta {
    id: number;
    name: string;
}

export interface SingleRegisterMeta {
    id: number;
    size: number;
    name: string;
}

export interface SingleRegisterInfo {
    id: number;
    value: number;
}

export interface CheckpointInfoResponse extends AbstractResponse {
    type: ResponseType.checkpointInfo;
    id: number;
    hit: boolean;
    startAddress: number;
    endAddress: number;
    stop: boolean;
    enabled: boolean;
    operation: CpuOperation;
    temporary: boolean;
    hitCount: number;
    ignoreCount: number;
    condition: boolean;
}

export enum CpuOperation {
    load = 0x01,
    store = 0x02,
    exec = 0x04
}

export enum EmulatorMemspace {
    main = 0x00,
    drive8 = 0x01,
    drive9 = 0x02,
    drive10 = 0x03,
    drive11 = 0x04
}

interface cache {
    abstract: AbstractResponse;
    checkpointInfo: CheckpointInfoResponse;
}

const abs : AbstractResponse = {
    apiVersion: 0x00,
    type: 0x00,
    error: 0xff,
    requestId: 0xff,
    related: [],
};

const cache : cache = {
    abstract: abs,
    checkpointInfo: {
        ...abs,
        type: ResponseType.checkpointInfo,
        id: -1,
        hit: false,
        startAddress: 0x00,
        endAddress: 0x00,
        stop: false,
        enabled: false,
        operation: CpuOperation.load,
        temporary: true,
        hitCount: 0,
        ignoreCount: 0,
        condition: false,
    }
};

export function responseBufferToObject(buf: Buffer, responseLength: number) : Response {
    const header_size = 12; // FIXME
    const body = buf.slice(header_size, responseLength);
    const res = cache.abstract;
    res.apiVersion = buf.readUInt8(1);
    res.type = buf.readUInt8(6);
    res.error = buf.readUInt8(7);
    res.requestId = buf.readUInt32LE(8);
    const type = res.type;

    // Special case for checkpoint info since we use it a lot
    // This will break if not carefully handled in async situations
    if(res.requestId == 0xffffffff && type == ResponseType.checkpointInfo) {
        const r = cache.checkpointInfo;
        r.apiVersion = res.apiVersion;
        r.error = res.error;
        r.requestId = res.requestId;

        r.type = ResponseType.checkpointInfo;
        r.id = body.readUInt32LE(0);
        r.hit = !!body.readUInt8(4);
        r.startAddress = body.readUInt16LE(5);
        r.endAddress = body.readUInt16LE(7);
        r.stop = !!body.readUInt8(9);
        r.enabled = !!body.readUInt8(10);
        r.operation = body.readUInt8(11);
        r.temporary = !!body.readUInt8(12);
        r.hitCount = body.readUInt32LE(13);
        r.ignoreCount = body.readUInt32LE(17);
        r.condition = !!body.readUInt8(21);

        return r;
    }
    else if(type == ResponseType.memoryGet) {
        const mem = Buffer.alloc(body.readUInt16LE(0));
        body.copy(mem, 0, 2);
        const r : MemoryGetResponse = {
            ...res,
            type,
            memory: mem,
        }

        return r;
    }
    else if(type == ResponseType.memorySet) {
        const r : MemorySetResponse = {
            ...res,
            type,
        }

        return r;
    }
    else if(type == ResponseType.checkpointInfo) {
        const r : CheckpointInfoResponse = {
            ...res,
            type,
            id: body.readUInt32LE(0),
            hit: !!body.readUInt8(4),
            startAddress: body.readUInt16LE(5),
            endAddress: body.readUInt16LE(7),
            stop: !!body.readUInt8(9),
            enabled: !!body.readUInt8(10),
            operation: body.readUInt8(11),
            temporary: !!body.readUInt8(12),
            hitCount: body.readUInt32LE(13),
            ignoreCount: body.readUInt32LE(17),
            condition:  !!body.readUInt8(21),
        };

        return r;
    }
    else if(type == ResponseType.checkpointDelete) {
        const r : CheckpointDeleteResponse = {
            ...res,
            type,
        };

        return r;
    }
    else if(type == ResponseType.checkpointList) {
        const r : CheckpointListResponse = {
            ...res,
            type,
            count: body.readUInt32LE(0),
            related: [],
        }

        return r;
    }
    else if(type == ResponseType.checkpointToggle) {
        const r : CheckpointToggleResponse = {
            ...res,
            type,
        }

        return r;
    }
    else if(type == ResponseType.conditionSet) {
        const r : ConditionSetResponse = {
            ...res,
            type,
        }

        return r;
    }
    else if(type == ResponseType.registerInfo) {
        const r : RegisterInfoResponse = {
            ...res,
            type,
            registers: [],
        };

        let cursor = 2;
        while(cursor < body.length) {
            const item_size = body.readUInt8(cursor + 0);
            const item : SingleRegisterInfo = {
                id: body.readUInt8(cursor + 1),
                value: body.readUInt16LE(cursor + 2),
            }
            r.registers.push(item);
            cursor += item_size + 1;
        }

        return r;
    }
    else if(type == ResponseType.dump) {
        const r : DumpResponse = {
            ...res,
            type,
        };

        return r;
    }
    else if(type == ResponseType.undump) {
        const r : UndumpResponse = {
            ...res,
            type,
            programCounter: body.readUInt16LE(0),
        }

        return r;
    }
    else if(type == ResponseType.resourceGet) {
        const r : ResourceGetResponse = {
            ...res,
            type,
            resourceType: body.readUInt8(0),
        }

        const length = body.readUInt8(1);
        if(r.resourceType == ResourceType.int) {
            if(length == 1) {
                r.intValue = body.readUInt8(2)
            }
            else if(length == 2) {
                r.intValue = body.readUInt16LE(2)
            }
            else if(length == 4) {
                r.intValue = body.readUInt32LE(2)
            }
            else {
                throw new Error("Invalid bit length int");
            }
        }
        else if(r.resourceType == ResourceType.string) {
            r.stringValue = body.toString("ascii", 2, 2 + length);
        }
        else {
            throw new Error("Invalid resource type");
        }

        return r;
    }
    else if(type == ResponseType.resourceSet) {
        const r : ResourceSetResponse = {
            ...res,
            type,
        }

        return r;
    }
    else if(type == ResponseType.advanceInstructions) {
        const r : AdvanceInstructionsResponse = {
            ...res,
            type,
        };

        return r;
    }
    else if(type == ResponseType.keyboardFeed) {
        const r : KeyboardFeedResponse = {
            ...res,
            type,
        };

        return r;
    }
    else if(type == ResponseType.executeUntilReturn) {
        const r : ExecuteUntilReturnResponse = {
            ...res,
            type,
        }

        return r;
    }
    else if(type == ResponseType.ping) {
        const r : PingResponse = {
            ...res,
            type,
        };

        return r;
    }
    else if(type == ResponseType.banksAvailable) {
        const r : BanksAvailableResponse = {
            ...res,
            type,
            banks: [],
        }

        //const count = body.readUInt16LE(0);
        let cursor = 2;
        while(cursor < body.length) {
            const item_size = body.readUInt8(cursor + 0);
            const nameLength = body.readUInt8(cursor + 3);
            const item : SingleBankMeta = {
                id: body.readUInt16LE(cursor + 1),
                name: body.toString("ascii", cursor + 4, cursor + 4 + nameLength),
            }
            r.banks.push(item);
            cursor += item_size + 1;
        }

        return r;
    }
    else if(type == ResponseType.registersAvailable) {
        const r : RegistersAvailableResponse = {
            ...res,
            type,
            registers: [],
        }

        //const count = body.readUInt16LE(0);
        let cursor = 2;
        while(cursor < body.length) {
            const item_size = body.readUInt8(cursor + 0);
            const nameLength = body.readUInt8(cursor + 3);
            const item : SingleRegisterMeta = {
                id: body.readUInt8(cursor + 1),
                size: body.readUInt8(cursor + 2),
                name: body.toString("ascii", cursor + 4, cursor + 4 + nameLength),
            }
            r.registers.push(item);
            cursor += item_size + 1;
        }

        return r;
    }
    else if(type == ResponseType.displayGet) {
        if(res.apiVersion < 0x02) {
            const targaImageData = Buffer.alloc(body.length - (12 + body.readUInt32LE(4)));
            body.copy(targaImageData, 0, 12 + body.readUInt32LE(4));
            const rawImageData = targaImageData.slice(targaImageData.length - body.readUInt32LE(8));
            const r : DisplayGetResponse = {
                ...res,
                type,
                debugWidth: body.readUInt16LE(12),
                debugHeight: body.readUInt16LE(14),
                offsetX: body.readUInt16LE(16),
                offsetY: body.readUInt16LE(18),
                innerWidth: body.readUInt16LE(20),
                innerHeight: body.readUInt16LE(22),
                bpp: body.readUInt8(23),
                rawImageData: rawImageData,
            };

            return r;
        }
        else {
            const metaLength = body.readUInt32LE(0)
            const rawImageData = Buffer.alloc(body.readUInt32LE(metaLength + 4));
            body.copy(rawImageData, 0, 4 + metaLength + 4)
            const r : DisplayGetResponse = {
                ...res,
                type,
                debugWidth: body.readUInt16LE(4),
                debugHeight: body.readUInt16LE(6),
                offsetX: body.readUInt16LE(8),
                offsetY: body.readUInt16LE(10),
                innerWidth: body.readUInt16LE(12),
                innerHeight: body.readUInt16LE(14),
                bpp: body.readUInt8(16),
                rawImageData: rawImageData,
            };

            return r;
        }
    }
    else if(type == ResponseType.viceInfo) {
        const versionLength = body.readUInt8(0);
        const revLength = body.readUInt8(1 + versionLength);
        const r : ViceInfoResponse = {
            ...res,
            type,
            viceVersion: Array.from(body.slice(1, 1 + versionLength)),
            svnRevision: body.slice(1 + versionLength + 1, 1 + versionLength + 1 + revLength).readUInt32LE(0),
        };

        return r;
    }
    else if(type == ResponseType.paletteGet) {
        const r : PaletteGetResponse = {
            ...res,
            entries: [],
            type
        }

        let cursor = 2;
        while(cursor < body.length) {
            const item_size = body.readUInt8(cursor + 0);
            const item : PaletteEntry = {
                red: body.readUInt8(cursor + 1),
                green: body.readUInt8(cursor + 2),
                blue: body.readUInt8(cursor + 3),
                dither: body.readUInt8(cursor + 4),
            }
            r.entries.push(item);
            cursor += item_size + 1;
        }

        return r;
    }
    else if(type == ResponseType.exit) {
        const r : ExitResponse = {
            ...res,
            type
        };

        return r;
    }
    else if(type == ResponseType.quit) {
        const r : QuitResponse = {
            ...res,
            type,
        };

        return r;
    }
    else if(type == ResponseType.reset) {
        const r : ResetResponse = {
            ...res,
            type,
        };

        return r;
    }
    else if(type == ResponseType.autostart) {
        const r : AutostartResponse = {
            ...res,
            type,
        };

        return r;
    }
    else if(type == ResponseType.jam) {
        const r : JamResponse = {
            ...res,
            type,
            programCounter: body.readUInt16LE(0),
        };

        return r;
    }
    else if(type == ResponseType.stopped) {
        const r : StoppedResponse = {
            ...res,
            type,
            programCounter: body.readUInt16LE(0),
        };

        return r;
    }
    else if(type == ResponseType.resumed) {
        const r : ResumedResponse = {
            ...res,
            type,
            programCounter: body.readUInt16LE(0),
        };

        return r;
    }
    else {
        const r : UnknownResponse = {
            ...res,
            type: ResponseType.unknown,
            rawBody: body,
        }

        return r;
    }
}

export function commandObjectToBytes(c: Command, buf: Buffer) : Buffer {
    let length = 0;
    if(c.type == CommandType.memoryGet) {
        length = 8;
        buf.writeUInt8(Number(c.sidefx), 0);
        buf.writeUInt16LE(c.startAddress, 1);
        buf.writeUInt16LE(c.endAddress, 3);
        buf.writeUInt8(c.memspace, 5);
        buf.writeUInt16LE(c.bankId, 6);
    }
    else if(c.type == CommandType.memorySet) {
        length = 8 + c.memory.length;
        if(buf.length < length) {
            buf = Buffer.alloc(length)
        }
        buf.writeUInt8(Number(c.sidefx), 0);
        buf.writeUInt16LE(c.startAddress, 1);
        buf.writeUInt16LE(c.endAddress, 3);
        buf.writeUInt8(c.memspace, 5);
        buf.writeUInt16LE(c.bankId, 6);

        Buffer.from(c.memory).copy(buf, 8);
    }
    else if(c.type == CommandType.checkpointGet) {
        length = 4;
        buf.writeUInt32LE(c.id, 0);
    }
    else if(c.type == CommandType.checkpointSet) {
        length = 8;
        buf.writeUInt16LE(c.startAddress, 0);
        buf.writeUInt16LE(c.endAddress, 2);
        buf.writeUInt8(Number(c.stop), 4);
        buf.writeUInt8(Number(c.enabled), 5);
        buf.writeUInt8(c.operation, 6);
        buf.writeUInt8(Number(c.temporary), 7);
    }
    else if(c.type == CommandType.checkpointDelete) {
        length = 4;
        buf.writeUInt32LE(c.id, 0);
    }
    else if(c.type == CommandType.checkpointList) {
        length = 0;
    }
    else if(c.type == CommandType.checkpointToggle) {
        length = 5;
        buf.writeUInt32LE(c.id, 0);
        buf.writeUInt8(Number(c.enabled), 4);
    }
    else if(c.type == CommandType.conditionSet) {
        length = 5 + c.condition.length;
        buf.writeUInt32LE(c.checkpointId, 0);
        buf.writeUInt8(c.condition.length, 4);

        buf.write(c.condition, 5, "ascii");
    }
    else if(c.type == CommandType.registersGet) {
        length = 1;
        buf.writeUInt8(c.memspace);
    }
    else if(c.type == CommandType.registersSet) {
        length = 4 * c.registers.length + 3;
        if(buf.length < length) {
            buf = Buffer.alloc(length);
        }

        buf.writeUInt8(c.memspace, 0);
        buf.writeUInt16LE(c.registers.length, 1);
        const itemsBuf = buf.slice(3);
        c.registers.forEach((reg, r) => {
            const item = itemsBuf.slice(r * 4);
            item.writeUInt8(3, 0);
            item.writeUInt8(reg.id, 1);
            item.writeUInt16LE(reg.value, 2);
        });
    }
    else if(c.type == CommandType.dump) {
        length = 3 + c.filename.length;
        buf.writeUInt8(Number(c.saveRoms), 0);
        buf.writeUInt8(Number(c.saveDisks), 1);
        buf.writeUInt8(c.filename.length, 2);

        buf.write(c.filename, 3, "ascii");
    }
    else if(c.type == CommandType.undump) {
        length = 1 + c.filename.length;
        buf.writeUInt8(c.filename.length, 0);

        buf.write(c.filename, 1, "ascii");
    }
    else if(c.type == CommandType.resourceGet) {
        length = 1 + c.resourceName.length;
        buf.writeUInt8(c.resourceName.length, 0);

        buf.write(c.resourceName, 1, "ascii");
    }
    else if(c.type == CommandType.resourceSet) {
        const valueLength = _isString(c.resourceValue) ? c.resourceValue.length : 4;
        length = 3 + c.resourceName.length + valueLength;
        buf.writeUInt8(c.resourceType, 0);
        buf.writeUInt8(c.resourceName.length, 1);

        buf.write(c.resourceName, 2, "ascii");

        buf.writeUInt8(valueLength, 2 + c.resourceName.length);
        if(c.resourceType == ResourceType.int) {
            buf.writeUInt32LE(<number>c.resourceValue, 3 + c.resourceName.length)
        }
        else if(c.resourceType == ResourceType.string) {

            buf.write(<string>c.resourceValue, 3 + c.resourceName.length, "ascii")

        }
        else {
            throw new Error("Invalid Type");
        }
    }
    else if(c.type == CommandType.advanceInstructions) {
        length = 3;
        buf.writeUInt8(Number(c.stepOverSubroutines), 0);
        buf.writeUInt16LE(c.count, 1);
    }
    else if(c.type == CommandType.keyboardFeed) {
        length = 1 + c.text.length;
        buf.writeUInt8(c.text.length, 0);

        buf.write(c.text, 1, "ascii");
    }
    else if(c.type == CommandType.executeUntilReturn) {
        length = 0;
    }
    else if(c.type == CommandType.ping) {
        length = 0;
    }
    else if(c.type == CommandType.banksAvailable) {
        length = 0;
    }
    else if(c.type == CommandType.registersAvailable) {
        buf.writeUInt8(c.memspace, 0);
        length = 1;
    }
    else if(c.type == CommandType.displayGet) {
        length = 2;
        buf.writeUInt8(Number(c.useVicII), 0);
        buf.writeUInt8(c.format, 1);
    }
    else if(c.type == CommandType.viceInfo) {
        length = 0;
    }
    else if(c.type == CommandType.paletteGet) {
        length = 1
        buf.writeUInt8(Number(c.useVicII), 0)
    }
    else if(c.type == CommandType.exit) {
        length = 0;
    }
    else if(c.type == CommandType.quit) {
        length = 0;
    }
    else if(c.type == CommandType.reset) {
        length = 1;
        buf.writeUInt8(c.resetMethod, 0);
    }
    else if(c.type == CommandType.autostart) {
        length = 4 + c.filename.length;
        buf.writeUInt8(Number(c.run), 0);
        buf.writeUInt16LE(c.index, 1);
        buf.writeUInt8(c.filename.length, 3);

        buf.write(c.filename, 4, "ascii");
    }
    else {
        throw new Error("Invalid VICE monitor command");
    }

    return buf.slice(0, length);
}