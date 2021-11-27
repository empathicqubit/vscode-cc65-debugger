
const args = process.argv.slice(2);

const merged = {};
for(const arg of args) {
    const run = require(arg + '.json');
    for(const file of run.testResults) {
        for(const assertion of file.assertionResults) {
            merged[assertion.fullName] = merged[assertion.fullName]
                || (assertion.status == "passed");
        }
    }

}

for(const k in merged) {
    console.log(k, merged[k] ? '\u2714\ufe0f': '\u274c');
}

let passed = true;
for(const k in merged) {
    passed = passed && merged[k];
}

process.exit(!passed);
