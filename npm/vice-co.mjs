import * as fs from 'fs';
import shx from './shelljs.js';

try {
    shx.exec(`svn checkout svn://svn.code.sf.net/p/vice-emu/code/${process.env.VICE_SVN_VERSION || 'trunk' }/vice ./src/__tests__/vicedir`);
    shx.exec('svn info ./src/__tests__/vicedir');
}
catch {
    shx.exec('svn cleanup ./src/__tests__/vicedir');
}