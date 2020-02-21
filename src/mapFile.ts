export interface MapRef {
	functionName: string;
	functionAddress: number;
}

export function parse(text: string) : MapRef[] {
	const piece = text.split(/(Exports list by value|Imports list)/gi)[2];
	const funcrex = /\b(\w+)\s+([0-9a-f]+)\s+RLA/gi
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