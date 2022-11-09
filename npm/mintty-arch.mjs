import shx from 'shelljs';
import * as path from 'path';
import yargs from 'yargs';
import { maybeMkdir } from './utils.mjs';

const arg = yargs(process.argv.slice(2)).argv._
console.log(arg);
const [arch] = arg;
shx.config.fatal = true;

const rootDir = process.cwd();

/**
 * @param {string} url
 * @param {string} dest
 */
const downloadFile = (url, dest) => {
    const dirname = path.dirname(dest);
    maybeMkdir(dirname);

    if(!shx.test('-e', dest)) {
        shx.exec('curl -L "' + url + '" > "' + dest + '"');
    }
};

/**
 * @param {string[]} files
 * @param {string} src
 */
const sevenzx = (src, ...files) => {
    const zip7 = shx.which('7zz') || shx.which('7z');

    if(files.every(x => shx.test('-e', x))) {
        return;
    }

    shx.exec(zip7 + ' x -y "' + src + '" ' + files.map(x => `"${x}"`).join(' '));
}

/**
 * @param {string[]} files
 * @param {string} src
 */
const untar = (src, ...files) => {
    if(files.every(x => shx.test('-e', x))) {
        return;
    }

    shx.exec('tar -x -v -f "' + src + '" ' + files.map(x => `"${x}"`).join(' '))
}

/**
 * @param {string[]} files
 * @param {string} src
 */
const unzst = (src) => {
    if(shx.test('-e', src.replace(/\.zst$/g, ''))) {
        return;
    }

    shx.exec(`zstd -f -d -k "${src}"`);
}

try {
    console.time('mintty');

    if(arch == 'win32_x64') {
        downloadFile('https://github.com/git-for-windows/git/releases/download/v2.33.0.windows.2/PortableGit-2.33.0.2-64-bit.7z.exe', `obj/mintty/${arch}/git.7z.exe`);
    }
    else if(arch == 'win32_x32') {
        downloadFile('https://github.com/git-for-windows/git/releases/download/v2.33.0.windows.2/PortableGit-2.33.0.2-32-bit.7z.exe', `obj/mintty/${arch}/git.7z.exe`);
    }

    shx.cd('obj/mintty/' + arch);
    sevenzx('./git.7z.exe', 'usr/bin/mintty.exe', 'usr/bin/msys-2.0.dll');

    const distDir = '../../../dist/mintty/bin_' + arch;
    maybeMkdir(distDir);
    shx.cp('-ru', 'usr/bin/.', distDir);

    console.timeEnd('mintty');
}
catch (e) {
    shx.rm('-rf', rootDir + '/obj/mintty');
    throw e;
}