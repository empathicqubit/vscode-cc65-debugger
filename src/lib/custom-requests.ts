export interface MessageActionedRequest {
    arguments: {
        name: string;
    }
}

export interface DisassembleLineRequest {
    arguments: {
        filename: string;
        line: number;
        count: number;
    }
}