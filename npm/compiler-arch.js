const main = async() => {
    const shx = require('shelljs');
    const os = require('os');
    const yargs = require('yargs');
    const threads = os.cpus().length * 4;
    console.log('THREADS', threads);
    shx.config.fatal = true;
    const arg = yargs.argv._;
    console.log(arg);
    let [arch, cross] = arg;
    cross = cross || '';
    const archDir = '3rdparty/cc65/wrk/' + arch;
    const distDir = process.cwd() + '/dist/cc65/bin_' + arch;
    if(shx.test('-e', distDir)) {
        process.exit(0);
    }
    shx.mkdir('-p', archDir)
    shx.cp('-ru', archDir + '/../../src/', archDir)
    shx.cd(archDir + '/src')
    const makeRes = shx.exec(`make -j${threads} CROSS_COMPILE=` + cross, { silent: true })
    const stdout = makeRes.stdout.split(/\s*[\r\n]+\s*/gi).filter(x => !/\..$/g.test(x)).join('\n');
    console.log(stdout);
    console.error(makeRes.stderr);
    shx.find('../bin/*').forEach(binFile => {
        shx.exec(cross + 'strip ' + binFile);
    })
    shx.mkdir('-p', distDir);
    shx.cp('-ru', '../bin/.', distDir);
    if(arch.startsWith('linux')) {
        shx.find(distDir)
            .filter(p => p.endsWith('.exe'))
            .forEach(p => {
                shx.mv(p, p.replace(/\.exe$/g, ''));
            });
    }
};

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });