const yargs = require('yargs');
const shx = require('shelljs');
const path = require('path');
const arg = yargs.argv._
console.log(arg);
const [arch] = arg;
shx.config.fatal = true;

const maybeMkdir = (dirname) => {
    if(shx.test('-e', dirname)) {
        return;
    }

    shx.mkdir('-p', dirname);
};

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

    shx.exec(zip7 + ' x -y "' + src + '" ' + files.map(x => `"${x}"`).join(''));
}

/**
 * @param {string[]} files
 * @param {string} src
 */
const untar = (src, ...files) => {
    if(files.every(x => shx.test('-e', x))) {
        return;
    }

    shx.exec('tar -x -v -f "' + src + '" ' + files.map(x => `"${x}"`).join(''))
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

    if(process.platform == 'win32') {
        downloadFile('https://github.com/facebook/zstd/releases/download/v1.5.2/zstd-v1.5.2-win32.zip', 'obj/mintty/zstd.zip');
        shx.cd('obj/mintty');
        sevenzx('./zstd.zip', 'zstd-v1.5.2-win32/zstd.exe');
        process.env.PATH = process.env.PATH + ";" + __dirname + "/../obj/mintty/zstd-v1.5.2-win32";
        shx.cd('../..');
    }

    if(arch == 'win32_x64') {
        downloadFile('https://repo.msys2.org/msys/x86_64/msys2-runtime-3.3.6-3-x86_64.pkg.tar.zst', `obj/mintty/${arch}/msys2-runtime.pkg.tar.zst`);
        downloadFile('https://mirror.msys2.org/msys/x86_64/mintty-1~3.6.1-2-x86_64.pkg.tar.zst', `obj/mintty/${arch}/mintty.pkg.tar.zst`);
    }
    else if(arch == 'win32_x32') {
        downloadFile('https://repo.msys2.org/msys/i686/msys2-runtime-3.2.0-14-i686.pkg.tar.zst', `obj/mintty/${arch}/msys2-runtime.pkg.tar.zst`);
        downloadFile('https://mirror.msys2.org/msys/i686/mintty-1~3.5.0-1-i686.pkg.tar.zst', `obj/mintty/${arch}/mintty.pkg.tar.zst`);
    }

    shx.cd('obj/mintty/' + arch);
    unzst('./mintty.pkg.tar.zst');
    unzst('./msys2-runtime.pkg.tar.zst');

    untar('./mintty.pkg.tar', 'usr/bin/mintty.exe');
    untar('./msys2-runtime.pkg.tar', 'usr/bin/msys-2.0.dll');

    const distDir = '../../../dist/mintty/bin_' + arch;
    maybeMkdir(distDir);
    shx.cp('-ru', 'usr/bin/.', distDir);

    console.timeEnd('mintty');
}
catch (e) {
    shx.rm('-rf', __dirname + '/../obj/mintty');
    throw e;
}