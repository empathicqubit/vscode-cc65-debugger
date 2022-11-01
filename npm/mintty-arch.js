const yargs = require('yargs');
const shx = require('shelljs');
const arg = yargs.argv._
console.log(arg);
const [arch, file] = arg;
shx.config.fatal = true;

try {
    const workDir = 'obj/mintty/' + arch + '/git';
    if(!shx.test('-e', workDir)) {
        shx.mkdir('-p', workDir);
    }
    shx.cd(workDir);
    if(!shx.test('-e', file)) {
        shx.exec('curl -L https://github.com/git-for-windows/git/releases/download/v2.33.0.windows.2/' + file + ' > "' + file + '"');
    }

    const distDir = '../../../../dist/mintty/bin_' + arch;
    if(!shx.test('-e', distDir + '/mintty.exe')) {
        const zip7 = shx.which('7zz') || shx.which('7z');
        shx.exec(zip7 + ' x -y ' + file + ' usr/bin/msys-2.0.dll usr/bin/mintty.exe');
        if(!shx.test('-e', distDir)) {
            shx.mkdir('-p', distDir);
            shx.cp('-ru', 'usr/bin/.', distDir);
        }
    }
}
catch (e) {
    shx.rm(file);
    throw e;
}