
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

console.log(merged);

let passed = true;
for(const k in merged) {
    passed = passed && merged[k];
}

process.exit(!passed);