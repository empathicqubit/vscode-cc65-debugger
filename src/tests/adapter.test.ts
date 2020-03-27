import assert = require('assert');
import * as path from 'path';
import {DebugClient} from 'vscode-debugadapter-testsupport';
import {DebugProtocol} from 'vscode-debugprotocol';
import { LaunchRequestArguments } from '../cc65ViceDebug';

suite('Node Debug Adapter', function() {
    this.timeout(0);

    const PROJECT_ROOT = path.join(__dirname, '../../');

    const DEBUG_ADAPTER = PROJECT_ROOT + '/out/debugAdapter.js';

    const WORKSPACE_FOLDER = PROJECT_ROOT + '/src/tests/simple-project';

    let dc: DebugClient;

    setup( () => {
        dc = new DebugClient('node', DEBUG_ADAPTER, 'cc65-vice', {
            stdio: 'pipe',
            shell: false,
            env: {
                ...process.env,
                NODE_ENV: 'test',
            },
        }, true);
        dc.on('output', evt => {
            console.log(evt.body.output);
        });
        return dc.start(process.env.PORT ? parseInt(process.env.PORT) : undefined);
    });

    teardown( () => dc.stop() );


    suite('basic', () => {

        test('unknown request should produce error', done => {
            dc.send('illegal_request').then(() => {
                done(new Error("does not report error on unknown request"));
            }).catch(() => {
                done();
            });
        });
    });

    suite('initialize', () => {

        test('should return supported features', () => {
            return dc.initializeRequest().then(response => {
                response.body = response.body || {};
                assert.equal(response.body.supportsConfigurationDoneRequest, true);
            });
        });

        test('should produce error for invalid \'pathFormat\'', done => {
            dc.initializeRequest({
                adapterID: 'mock',
                linesStartAt1: true,
                columnsStartAt1: true,
                pathFormat: 'url'
            }).then(response => {
                done(new Error("does not report error on invalid 'pathFormat' attribute"));
            }).catch(err => {
                // error expected
                done();
            });
        });
    });

    suite('launch', () => {

        test('should run program to the end', () => {
            return Promise.all([
                dc.configurationSequence(),
                dc.launch(<LaunchRequestArguments>{
                    buildCwd: WORKSPACE_FOLDER,
                    console: 'externalTerminal',
                    stopOnEntry: false,
                }),
                dc.waitForEvent('terminated', 60000)
            ]);
        });

        test('should stop on entry', () => {

            /*
            const PROGRAM = Path.join(DATA_ROOT, 'test.md');
            const ENTRY_LINE = 1;

            return Promise.all([
                dc.configurationSequence(),
                dc.launch({ program: PROGRAM, stopOnEntry: true }),
                dc.assertStoppedLocation('entry', { line: ENTRY_LINE } )
            ]);
            */
        });
    });

    suite('setBreakpoints', () => {

        test('should stop on a breakpoint', () => {
            const BREAKPOINT_LINE = 1;

            return dc.hitBreakpoint(<LaunchRequestArguments>{
                buildCwd: WORKSPACE_FOLDER,
            }, { path: path.normalize(WORKSPACE_FOLDER + "/src/main.c"), line: BREAKPOINT_LINE } );
        });

        test('hitting a lazy breakpoint should send a breakpoint event', () => {

            /*
            const PROGRAM = Path.join(DATA_ROOT, 'testLazyBreakpoint.md');
            const BREAKPOINT_LINE = 3;

            return Promise.all([

                dc.hitBreakpoint({ program: PROGRAM }, { path: PROGRAM, line: BREAKPOINT_LINE, verified: false } ),

                dc.waitForEvent('breakpoint').then((event : DebugProtocol.BreakpointEvent ) => {
                    assert.equal(event.body.breakpoint.verified, true, "event mismatch: verified");
                })
            ]);
            */
        });
    });

    suite('setExceptionBreakpoints', () => {

        test('should stop on an exception', () => {

            /*
            const PROGRAM_WITH_EXCEPTION = Path.join(DATA_ROOT, 'testWithException.md');
            const EXCEPTION_LINE = 4;

            return Promise.all([

                dc.waitForEvent('initialized').then(event => {
                    return dc.setExceptionBreakpointsRequest({
                        filters: [ 'all' ]
                    });
                }).then(response => {
                    return dc.configurationDoneRequest();
                }),

                dc.launch({ program: PROGRAM_WITH_EXCEPTION }),

                dc.assertStoppedLocation('exception', { line: EXCEPTION_LINE } )
            ]);
            */
        });
    });
});