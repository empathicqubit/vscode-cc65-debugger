const shx = require('shelljs');
shx.config.fatal = true;
const arg = process.argv; 
console.log(arg);
let [,, arch, cross] = arg;
cross = cross || '';
const archDir = '3rdparty/cc65/wrk/' + arch;
const distDir = process.cwd() + '/dist/cc65/bin_' + arch;
if(shx.test('-e', distDir)) {
    process.exit(0);
}
shx.mkdir('-p', archDir)
shx.cp('-ru', archDir + '/../../src/', archDir)
shx.cd(archDir + '/src')
shx.exec('make -j8 CROSS_COMPILE=' + cross)
shx.exec(cross + 'strip ../bin/*')
shx.mkdir('-p', distDir)
shx.cp('-ru', '../bin/.', distDir);
if(arch.startsWith('linux')) {
    shx.find(distDir)
        .filter(p => p.endsWith('.exe'))
        .forEach(p => {
            shx.mv(p, p.replace(/\.exe$/g, ''));
        });
}