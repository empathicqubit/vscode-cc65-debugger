import * as _ from "lodash";
import { BreakpointEvent } from "vscode-debugadapter";
import { Color } from "vscode";

export interface Command {
    type: CommandType
    /** The type of the response. If included the handler will collect
     * responses with the request ID until this type is seen. */
    responseType?: ResponseType
}

export interface AbstractResponse {
    /** Currently 1 */
    apiVersion: number;
    type: ResponseType;
    error: number;
    requestId: number;
    /** Any responses that occurred before this one which had the same request ID */
    related: AbstractResponse[];
}

export interface Response<T extends Command> extends AbstractResponse {
}

export interface UnknownResponse extends Response<Command> {
    /** The binary body of the command, which does not include the headers */
    rawBody: Uint8Array
}

export interface RegisterCommand extends Command {};

export interface CheckpointCommand extends Command {};

export interface MemoryGetCommand extends Command {
    type: CommandType.memoryGet;
    sidefx: boolean;
    startAddress: number;
    endAddress: number;
    memspace: ViceMemspace;
    bankId: number;
}

export interface MemoryGetResponse extends Response<MemoryGetCommand> {
    type: ResponseType.memoryGet;
    memory: Uint8Array;
}

export interface MemorySetCommand extends Command {
    type: CommandType.memorySet;
    sidefx: boolean;
    startAddress: number;
    endAddress: number;
    memspace: ViceMemspace;
    bankId: number;
    memory: Uint8Array;
}

export interface MemorySetResponse extends Response<MemorySetCommand> {
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

export interface CheckpointDeleteCommand extends Command {
    type: CommandType.checkpointDelete;
    id: number;
}

export interface CheckpointDeleteResponse extends Response<CheckpointDeleteCommand> {
    type: ResponseType.checkpointDelete;
}

export interface CheckpointListCommand extends Command {
    type: CommandType.checkpointList;
}

export interface CheckpointListResponse extends Response<CheckpointListCommand> {
    type: ResponseType.checkpointList;
    related: CheckpointInfoResponse[];
    count: number
}


export interface CheckpointToggleCommand extends Command {
    type: CommandType.checkpointToggle;
    id: number;
    enabled: boolean;
}

export interface CheckpointToggleResponse extends Response<CheckpointToggleCommand> {
    type: ResponseType.checkpointToggle;
}

export interface ConditionSetCommand extends Command {
    type: CommandType.conditionSet;
    checkpointId: number;
    condition: string;
}

export interface ConditionSetResponse extends Response<ConditionSetCommand> {
    type: ResponseType.conditionSet;
}

export interface RegistersGetCommand extends RegisterCommand {
    type: CommandType.registersGet;
}

export interface RegistersSetCommand extends RegisterCommand {
    type: CommandType.registersSet;
    registers: SingleRegisterInfo[];
}

export interface DumpCommand extends Command {
    type: CommandType.dump;
    saveRoms: boolean;
    saveDisks: boolean;
    filename: string;
}

export interface DumpResponse extends Response<DumpCommand> {
    type: ResponseType.dump;
}

export interface UndumpCommand extends Command {
    type: CommandType.undump;
    filename: string;
}

export interface UndumpResponse extends Response<UndumpCommand> {
    type: ResponseType.undump;
    programCounter: number;
}

export enum ResourceType {
    string = 0x00,
    int = 0x01,
}

export interface ResourceGetCommand extends Command {
    type: CommandType.resourceGet;
    resourceName: string;
}

export interface ResourceGetResponse extends Response<ResourceGetCommand> {
    type: ResponseType.resourceGet;
    resourceType: ResourceType;
    intValue?: number;
    stringValue?: string;
}

export interface ResourceSetCommand extends Command {
    type: CommandType.resourceSet;
    resourceType: ResourceType;
    resourceName: string;
    resourceValue: string | number;
}

export interface ResourceSetResponse extends Response<ResourceSetCommand> {
    type: ResponseType.resourceSet;
}

export interface AdvanceInstructionsCommand extends Command {
    type: CommandType.advanceInstructions;
    subroutines: boolean;
    count: number;
}

export interface AdvanceInstructionsResponse extends Response<AdvanceInstructionsCommand> {
    type: ResponseType.advanceInstructions;
}

export interface KeyboardFeedCommand extends Command {
    type: CommandType.keyboardFeed;
    text: string;
}

export interface KeyboardFeedResponse extends Response<KeyboardFeedCommand> {
    type: ResponseType.keyboardFeed;
}

export interface ExecuteUntilReturnCommand extends Command {
    type: CommandType.executeUntilReturn;
}

export interface ExecuteUntilReturnResponse extends Response<ExecuteUntilReturnCommand> {
    type: ResponseType.executeUntilReturn;
}

export interface PingCommand extends Command {
    type: CommandType.ping;
}

export interface PingResponse extends Response<PingCommand> {
    type: ResponseType.ping;
}

export interface BanksAvailableCommand extends Command {
    type: CommandType.banksAvailable;
}

export interface BanksAvailableResponse extends Response<BanksAvailableCommand> {
    type: ResponseType.banksAvailable;
    banks: SingleBankMeta[];
}

export interface RegistersAvailableCommand extends Command {
    type: CommandType.registersAvailable;
}

export interface RegistersAvailableResponse extends Response<RegistersAvailableCommand> {
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

export interface DisplayGetCommand extends Command {
    type: CommandType.displayGet;
    useVicII: boolean;
    format: DisplayGetFormat;
}

export interface DisplayGetResponse extends Response<DisplayGetCommand> {
    type: ResponseType.displayGet;
    debugWidth: number;
    debugHeight: number;
    offsetX: number;
    offsetY: number;
    innerWidth: number;
    innerHeight: number;
    bpp: number;
    imageData: Buffer;
    displayBuffer: Buffer;
}

export interface ExitCommand extends Command {
    type: CommandType.exit;
}

export interface ExitResponse extends Response<ExitCommand> {
    type: ResponseType.exit;
}

export interface QuitCommand extends Command {
    type: CommandType.quit;
}

export interface QuitResponse extends Response<QuitCommand> {
    type: ResponseType.quit;
}

export interface ResetCommand extends Command {
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

export interface ResetResponse extends Response<ResetCommand> {
    type: ResponseType.reset;
}

export interface AutostartCommand extends Command {
    type: CommandType.autostart;
    run: boolean;
    index: number;
    filename: string;
}

export interface AutostartResponse extends Response<AutostartCommand> {
    type: ResponseType.autostart;
}

export interface JamResponse extends Response<Command> {
    type: ResponseType.jam;
    programCounter: number;
}

export interface StoppedResponse extends Response<Command> {
    type: ResponseType.stopped;
    programCounter: number;
}

export interface ResumedResponse extends Response<Command> {
    type: ResponseType.resumed;
    programCounter: number;
}

export interface RegisterInfoResponse extends Response<RegisterCommand> {
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

export interface CheckpointInfoResponse extends Response<CheckpointCommand> {
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

export enum ViceMemspace {
    main = 0x00,
    drive8 = 0x01,
    drive9 = 0x02,
    drive10 = 0x03,
    drive11 = 0x04
}

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

    exit = 0xaa,
    quit = 0xbb,
    reset = 0xcc,
    autostart = 0xdd,
}

export function responseBufferToObject(buf: Buffer, responseLength: number) : AbstractResponse {
    const header_size = 12; // FIXME
    const body = buf.slice(header_size, responseLength);
    const res : AbstractResponse = {
        apiVersion: buf.readUInt8(0),
        type: buf.readUInt8(6),
        error: buf.readUInt8(7),
        requestId: buf.readUInt32LE(8),
        related: [],
    };
    const type = res.type;

    if(type == ResponseType.memoryGet) {
        const r : MemoryGetResponse = {
            ...res,
            type,
            memory: body.slice(2, 2 + body.readUInt16LE(0)),
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
            condition: !!body.readUInt8(21),
        }

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

        const count = body.readUInt16LE(0);
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

        const count = body.readUInt16LE(0);
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

        const count = body.readUInt16LE(0);
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
        const r : DisplayGetResponse = {
            ...res,
            type,
            debugWidth: body.readUInt16LE(12),
            debugHeight: body.readUInt16LE(14),
            offsetX: body.readUInt16LE(16),
            offsetY: body.readUInt16LE(18),
            innerWidth: body.readUInt16LE(20),
            innerHeight: body.readUInt16LE(22),
            bpp: body.readUInt16LE(23),
            displayBuffer: body.slice(4 + body.readUInt32LE(0), body.length),
            imageData: body.slice(12 + body.readUInt32LE(4), body.length),
        };

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
            rawBody: body,
        }

        return r;
    }
}

export function commandObjectToBytes(command: Command) : Uint8Array {
    const type = (<any>command).type;
    if(type == CommandType.memoryGet) {
        const cmd = <MemoryGetCommand>command;
        const buf = Buffer.alloc(8);
        buf.writeUInt8(Number(cmd.sidefx), 0);
        buf.writeUInt16LE(cmd.startAddress, 1);
        buf.writeUInt16LE(cmd.endAddress, 3);
        buf.writeUInt8(cmd.memspace, 5);
        buf.writeUInt16LE(cmd.bankId, 6);

        return buf;
    }
    else if(type == CommandType.memorySet) {
        const cmd = <MemorySetCommand>command;
        const buf = Buffer.alloc(8);
        buf.writeUInt8(Number(cmd.sidefx), 0);
        buf.writeUInt16LE(cmd.startAddress, 1);
        buf.writeUInt16LE(cmd.endAddress, 3);
        buf.writeUInt8(cmd.memspace, 5);
        buf.writeUInt16LE(cmd.bankId, 6);

        return Buffer.concat([buf, cmd.memory]);
    }
    else if(type == CommandType.checkpointGet) {
        const cmd = <CheckpointGetCommand>command;
        const buf = Buffer.alloc(4);
        buf.writeUInt32LE(cmd.id, 0);

        return buf;
    }
    else if(type == CommandType.checkpointSet) {
        const cmd = <CheckpointSetCommand>command;
        const buf = Buffer.alloc(8);
        buf.writeUInt16LE(cmd.startAddress, 0);
        buf.writeUInt16LE(cmd.endAddress, 2);
        buf.writeUInt8(Number(cmd.stop), 4);
        buf.writeUInt8(Number(cmd.enabled), 5);
        buf.writeUInt8(cmd.operation, 6);
        buf.writeUInt8(Number(cmd.temporary), 7);

        return buf;
    }
    else if(type == CommandType.checkpointDelete) {
        const cmd = <CheckpointDeleteCommand>command;
        const buf = Buffer.alloc(4);
        buf.writeUInt32LE(cmd.id, 0);

        return buf;
    }
    else if(type == CommandType.checkpointList) {
        const cmd = <CheckpointListCommand>command;
        const buf = Buffer.alloc(0);
        return buf;
    }
    else if(type == CommandType.checkpointToggle) {
        const cmd = <CheckpointToggleCommand>command;
        const buf = Buffer.alloc(5);
        buf.writeUInt32LE(cmd.id, 0);
        buf.writeUInt8(Number(cmd.enabled), 4);

        return buf;
    }
    else if(type == CommandType.conditionSet) {
        const cmd = <ConditionSetCommand>command;
        const buf = Buffer.alloc(5);
        buf.writeUInt32LE(cmd.checkpointId, 0);
        buf.writeUInt8(cmd.condition.length, 4);

        return Buffer.concat([buf, Buffer.from(cmd.condition, "ascii")]);
    }
    else if(type == CommandType.registersGet) {
        const cmd = <RegistersGetCommand>command;
        const buf = Buffer.alloc(0);
        return buf;
    }
    else if(type == CommandType.registersSet) {
        const cmd = <RegistersSetCommand>command;
        const buf = Buffer.alloc(2);
        buf.writeUInt16LE(cmd.registers.length, 0);
        const items : Buffer[] = [];
        for(const reg of cmd.registers) {
            const item = Buffer.alloc(4);
            item.writeUInt8(3, 0);
            item.writeUInt8(reg.id, 1);
            item.writeUInt16LE(reg.value, 2);
            items.push(item);
        }

        return Buffer.concat([buf, ...items]);
    }
    else if(type == CommandType.dump) {
        const cmd = <DumpCommand>command;
        const buf = Buffer.alloc(3);
        buf.writeUInt8(Number(cmd.saveRoms), 0);
        buf.writeUInt8(Number(cmd.saveDisks), 1);
        buf.writeUInt8(cmd.filename.length, 2);

        return Buffer.concat([buf, Buffer.from(cmd.filename, "ascii")]);
    }
    else if(type == CommandType.undump) {
        const cmd = <UndumpCommand>command;
        const buf = Buffer.alloc(1);
        buf.writeUInt8(cmd.filename.length, 0);

        return Buffer.concat([buf, Buffer.from(cmd.filename, "ascii")])
    }
    else if(type == CommandType.resourceGet) {
        const cmd = <ResourceGetCommand>command;
        const buf = Buffer.alloc(1);
        buf.writeUInt8(Number(cmd.resourceName.length), 0);

        return Buffer.concat([buf, Buffer.from(cmd.resourceName, "ascii")]);
    }
    else if(type == CommandType.resourceSet) {
        const cmd = <ResourceSetCommand>command;
        const valueLength = _.isString(cmd.resourceValue) ? cmd.resourceValue.length : 4;
        const buf = Buffer.alloc(1 + cmd.resourceName.length + 1 + valueLength);
        buf.writeUInt8(cmd.resourceType, 0);
        buf.writeUInt8(cmd.resourceName.length, 1);
        buf.write(cmd.resourceName, 2, "ascii");
        buf.writeUInt8(valueLength, 2 + cmd.resourceName.length);
        if(cmd.resourceType == ResourceType.int) {
            buf.writeUInt32LE(<number>cmd.resourceValue, 3 + cmd.resourceName.length)
        }
        else if(type == ResourceType.string) {
            buf.write(<string>cmd.resourceValue, 3 + cmd.resourceName.length, "ascii")
        }
        else {
            throw new Error("Invalid Type");
        }

        return Buffer.concat([buf, Buffer.from(cmd.resourceName, "ascii")]);
    }
    else if(type == CommandType.advanceInstructions) {
        const cmd = <AdvanceInstructionsCommand>command;
        const buf = Buffer.alloc(3);
        buf.writeUInt8(Number(cmd.subroutines), 0);
        buf.writeUInt16LE(cmd.count, 1);

        return buf;
    }
    else if(type == CommandType.keyboardFeed) {
        const cmd = <KeyboardFeedCommand>command;
        const buf = Buffer.alloc(1);
        buf.writeUInt8(cmd.text.length, 0);

        return Buffer.concat([buf, Buffer.from(cmd.text, "ascii")]);
    }
    else if(type == CommandType.executeUntilReturn) {
        const cmd = <ExecuteUntilReturnCommand>command;
        const buf = Buffer.alloc(0);
        return buf;
    }
    else if(type == CommandType.ping) {
        const cmd = <PingCommand>command;
        const buf = Buffer.alloc(0);
        return buf;
    }
    else if(type == CommandType.banksAvailable) {
        const cmd = <BanksAvailableCommand>command;
        const buf = Buffer.alloc(0);
        return buf;
    }
    else if(type == CommandType.registersAvailable) {
        const cmd = <RegistersAvailableCommand>command;
        const buf = Buffer.alloc(0);
        return buf;
    }
    else if(type == CommandType.displayGet) {
        const cmd = <DisplayGetCommand>command;
        const buf = Buffer.alloc(2);
        buf.writeUInt8(Number(cmd.useVicII), 0);
        buf.writeUInt8(cmd.format, 1);
        return buf;
    }
    else if(type == CommandType.exit) {
        const cmd = <ExitCommand>command;
        const buf = Buffer.alloc(0);
        return buf;
    }
    else if(type == CommandType.quit) {
        const cmd = <QuitCommand>command;
        const buf = Buffer.alloc(0);
        return buf;
    }
    else if(type == CommandType.reset) {
        const cmd = <ResetCommand>command;
        const buf = Buffer.alloc(1);
        buf.writeUInt8(cmd.resetMethod, 0);

        return buf;
    }
    else if(type == CommandType.autostart) {
        const cmd = <AutostartCommand>command;
        const buf = Buffer.alloc(4);
        buf.writeUInt8(Number(cmd.run), 0);
        buf.writeUInt16LE(cmd.index, 1);
        buf.writeUInt8(cmd.filename.length, 3);

        return Buffer.concat([buf, Buffer.from(cmd.filename, "ascii")]);
    }
    else {
        throw new Error("Invalid VICE monitor command");
    }
}