import * as tableFile from '../lib/table-file';
import * as fs from 'fs';
import * as util from 'util';
import * as assert from 'assert';
import * as typeQuery from '../lib/type-query';

describe('Type query mechanics', () => {
    describe('Table File', () => {
        test('Can parse', async () => {
            const expected = require('./tab/result.tab.json');
            const actual = tableFile.parse('sample.tab', await util.promisify(fs.readFile)(__dirname + '/tab/sample.tab', 'utf8'));
            const itemTypes : string[] = [];
            actual.scopes.forEach(scope => scope.syms.forEach(sym => itemTypes.push(sym.type)));
            assert.deepStrictEqual(actual, expected);
        });
    });

    describe('Type query', () => {
        describe('Can parse type', () => {
            const data : Array<[string, {}]> = [
                ['(none)', { name: '' } ],
                ['union $anon-union-000B', {} ],
                ['unsigned char[8]', { array: { length: 8, itemType: 'unsigned char' } } ],
                ['struct __sid_voice', { name: 'struct __sid_voice', isStruct: true }],
                ['int', { isInt: true } ],
                ['long', { isLong: true }],
                ['unsigned char', { isSigned: false, isChar: true }],
                ['struct _FILE *(const char *, const char *, struct _FILE *)', { fn: { returnType: 'struct _FILE *' } }],
                ['l', { name: 'l' }],
                ['void[]', { array: {} }],
            ];
            test.each(data)('%s', async (typeName, expected) => {
                const type = typeQuery.parseTypeExpression(typeName);
                expect(type).toMatchObject(expected);
            });
        });

        test('Can find .tab files', async () => {
            const tabFiles = await typeQuery.getTabFiles(__dirname + '/tab');

            assert.strictEqual(tabFiles.length, 1, tabFiles.map(x => x.path).join(', '));
        });

        // FIXME Replace with more specific cases
        test('Can build a type graph', async () => {
            const expected = require('./tab/result.graph.json');
            const tabFiles = await typeQuery.getTabFiles(__dirname + '/tab');

            const actual = typeQuery.getLocalTypes(<any>null, tabFiles);

            assert.deepStrictEqual(actual, expected);
        });
    });
})