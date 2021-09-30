import * as assert from 'assert';
import * as disassembly from '../lib/disassembly';
describe('Disassembly', () => {
    test('Finds the correct assembly instructions in a byte sequence', () => {
        const expected = [
            0xad,
            0xa,
            0x90,
            0xe8,
            0x85,
            0x8a,
            0x18,
            0x69,
            0x85,
            0xad,
            0x85,
            0xad,
            0x85,
            0xb1,
            0xaa,
            0x88,
            0xb1,
            0x91,
            0xc8,
            0x8a,
            0x91,
            0xa2,
        ];

        const input = Buffer.from([
            0xad, 0x9b, 0x26,
            0x0a,
            0x90, 0x01,
            0xe8,
            0x85, 0x04,
            0x8a,
            0x18,
            0x69, 0xd0,
            0x85, 0x05,
            0xad, 0x9f, 0x26,
            0x85, 0x0b,
            0xad, 0x9e, 0x26,
            0x85, 0x0a,
            0xb1, 0x0a,
            0xaa,
            0x88,
            0xb1, 0x0a,
            0x91, 0x04,
            0xc8,
            0x8a,
            0x91, 0x04,
            0xa2 // This command is intentionally incomplete
        ]);

        const actual : number[] = []
        disassembly.opCodeFind(input, (cmd, __, ___) => {
            actual.push(cmd);
            return false;
        });

        assert.deepStrictEqual(actual, expected);
    });
})