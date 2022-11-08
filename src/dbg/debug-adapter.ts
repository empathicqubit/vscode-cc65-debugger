/*!
Copyright (c) 2022, EmpathicQubit

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

import * as compile from '../lib/compile';
import { CC65ViceDebugSession } from './debug-session';
import * as debugUtils from '../lib/debug-utils';

const build = async() => {
    await compile.build({
        cwd: process.cwd(),
        command: rest[0],
        args: rest.slice(1),
    }, debugUtils.DEFAULT_HEADLESS_EXEC_HANDLER(buf => process.stdout.write(buf), buf => process.stderr.write(buf)));
}

const [,,command,...rest] = process.argv;
if(command == 'build') {
    build().then(() => {
        process.exit(0);
    }).catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
else {
    CC65ViceDebugSession.run(CC65ViceDebugSession);
}
