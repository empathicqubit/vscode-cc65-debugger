import * as dbgfile from './debugFile';
import * as util from 'util';
import * as child_process from 'child_process';
import * as path from 'path';
import * as _ from 'lodash';

export interface ClangTypeInfo {
	name: string;
	type: string;
	aliasOf: string;
}

export async function getLocalTypes(dbgFile: dbgfile.Dbgfile) : Promise<{[typename: string]:ClangTypeInfo[]}> {
	// !/^((\/usr)?(\/local)?\/(share|lib|)|Program\s+Files(\(x86\))?)\//gi.test(x.name) FIXME Hopefully don't need this
	const codeFiles = dbgFile.files.filter(x => /\.(c|h)$/gi.test(x.name)).map(x => x.name);

	const varres = await util.promisify(child_process.execFile)('clang-query', ['-c=set output dump', '-c=match varDecl(isExpansionInMainFile(), hasAncestor(functionDecl()))', ...codeFiles])

	const varrex = /VarDecl\s+(0x[0-9a-f]+)\s+\<([^\n\r]+):([0-9]+):([0-9]+),\s+col:([0-9]+)\>\s+col:([0-9]+)\s+used\s+(\w+)\s+'([^']+)'(\s+cinit|:'([\w\s]+)')?$/gim;
	let varmatch;
	const structs : {[typename:string]:ClangTypeInfo[]} = {};
	const vars : ClangTypeInfo[] = [];
	while(varmatch = varrex.exec(varres.stdout)) {
		const lineNo = parseInt(varmatch[3]); // Numbered from 1, not 0
		const filename = path.normalize(varmatch[2]);
		const name = varmatch[7];
		const dist : number[] = [];
		const possibleSyms = dbgFile.csyms.filter(x => x.sc == dbgfile.sc.auto && x.name == name);

		const sym = _.minBy(possibleSyms, sym => {
			if(!sym.scope || !sym.scope.span || !sym.scope.span.lines.length) {
				return Number.MAX_SAFE_INTEGER;
			}

			const lines = sym.scope.span.lines.filter(x => x.file && x.file.name == filename)
			if(!lines.length) {
				return Number.MAX_SAFE_INTEGER;
			}
			else if(lineNo - 1 < lines[0].num) {
				return lines[0].num - (lineNo - 1);
			}
			else if(lineNo - 1 > _.last(lines)!.num) {
				return (lineNo - 1) - _.last(lines)!.num;
			}
			else return 0;
		});

		if(!sym) {
			continue;
		}

		const scope = sym.scope!;

		const type = varmatch[8];
		const aliasOf = varmatch[10];

		const varObj : ClangTypeInfo = {
			name,
			type,
			aliasOf
		}

		const vars = structs[scope.name + '()'] || [];
		vars.push(varObj);
		structs[scope.name + '()'] = vars;
	}

	const recordres = await util.promisify(child_process.execFile)('clang-query', ['-c=set output dump', '-c=match recordDecl(isExpansionInMainFile())', ...codeFiles]);
	const recordrex = /(RecordDecl\s+(0x[0-9a-f]+)\s+(prev\s+(0x[0-9a-f]+)\s+)?\<([^\n\r]+):([0-9]+):([0-9]+),\s+line:([0-9]+):([0-9]+)\>\s+line:([0-9]+):([0-9+])\s+struct\s+(\w+\s+)?definition$)/gim;

	const recordsplit = recordres.stdout.split(recordrex);

	for(let i = 1; i < recordsplit.length ; i+=13) {
		const fields : ClangTypeInfo[] = [];
		const recordname = (recordsplit[i + 11] || '').trim();
		if(!recordname) {
			continue; // FIXME We can't handle direct typedefs yet because they're complicated
			// Must declare as bare struct, then typedef that
		}

		const fieldres = recordsplit[i + 12];
		const fieldrex = /FieldDecl\s+(0x[0-9a-f]+)\s+\<line:([0-9]+):([0-9]+),\s+col:([0-9]+)\>\s+col:([0-9]+)\s+(referenced\s+)?(\w+)\s+'([^']+)'(:'([\w\s]+)')?$/gim;
		let fieldmatch : RegExpExecArray | null;
		while(fieldmatch = fieldrex.exec(fieldres)) {
			const name = fieldmatch[7];
			const type = fieldmatch[8];
			const aliasOf = fieldmatch[10];

			fields.push({
				name,
				type,
				aliasOf,
			})
		}

		if(!fields.length) {
			continue;
		}

		structs[recordname] = fields;
	}

	return structs;
};

export function recurseFieldSize(fields: ClangTypeInfo[], allTypes: {[typename:string]:ClangTypeInfo[]}) : number[] {
	const dataSizes : number[] = [];

	for(const field of fields) {
		const realType = field.aliasOf || field.type;
		if(realType.endsWith(' char')) {
			dataSizes.push(1);
		}
		else if(realType.endsWith(' int') || realType.endsWith('*')) {
			dataSizes.push(2);
		}
		else {
			const type = allTypes[realType];
			if(!type) {
				break; // We can't determine the rest of the fields if one is missing
			}

			dataSizes.push(_.sum(recurseFieldSize(type, allTypes)));
		}
	}

	return dataSizes;
}