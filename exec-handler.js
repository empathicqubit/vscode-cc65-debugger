const main = async() => {
    try {
        const res = await require('util').promisify(require('child_process').execFile)(process.argv[2], process.argv.slice(3), {
            shell: 'sh',
        });

        console.log(res.stdout);
        console.error(res.stderr);
    }
    catch (e) {
        console.log(e.stdout);
        console.error(e.stderr);

        throw e;
    }
};

main()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));