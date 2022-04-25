import { MachineType } from "../lib/debug-file";
import { AbstractGrip } from "./abstract-grip";
import { DisplayGetResponse } from "./binary-dto";

export class AppleWinGrip extends AbstractGrip {
    public autostart(program: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    public connect(binaryPort: number): Promise<void> {
        throw new Error("Method not implemented.");
    }
    public start(port: number, cwd: string, machineType: MachineType, emulatorPath: string, emulatorArgs?: string[], labelFile?: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    public displayGetRGBA(): Promise<DisplayGetResponse> {
        throw new Error("Method not implemented.");
    }
}