const { timingSafeEqual } = require('crypto');
const { readFileSync } = require('fs');
const { inspect } = require('util');

const { Server } = require('ssh2');

const allowedUser = Buffer.from('foo');
const allowedPassword = Buffer.from('bar');

function checkValue(input, allowed) {
    const autoReject = (input.length !== allowed.length);
    if (autoReject) {
        // Prevent leaking length information by always making a comparison with the
        // same input when lengths don't match what we expect ...
        allowed = input;
    }
    const isMatch = timingSafeEqual(input, allowed);
    return (!autoReject && isMatch);
}

new Server({
    // debug: (message) => console.log(message),
    hostKeys: [readFileSync('/etc/ssh/ssh_host_rsa_key')],
}, (client) => {
    console.log('Client connected!');
    client.on('error', (error) => {
        console.log(error);
    });
    client.on('authentication', (ctx) => {
        let allowed = true;
        if (!checkValue(Buffer.from(ctx.username), allowedUser))
            allowed = false;

        switch (ctx.method) {
            case 'password':
                if (!checkValue(Buffer.from(ctx.password), allowedPassword))
                    return ctx.reject();
                break;
            default:
                return ctx.reject();
        }

        if (allowed)
            ctx.accept();
        else
            ctx.reject();
    }).on('ready', () => {
        console.log('Client authenticated!');
        client.on('session', (accept, reject) => {
            const session = accept();
            session.on('shell', (accept, reject) => {
                const shell = accept();
                const prefix = "\r\nHacker's Den: ";
                shell.write(prefix, 'ascii', (err) => {
                    console.log(err);
                });
                shell.read();
                let data = '';
                shell.addListener('data', (chunk) => {
                    shell.write(chunk);
                    // console.log(chunk, Buffer.from('7f', 'hex'));
                    if(chunk.toString() === Buffer.from('7f', 'hex').toString()) {
                        if(data.length > 0) {
                            shell.write('\b \b');
                            data = data.substring(0, data.length - 1);
                        }
                    } else if (chunk.toString() === Buffer.from('0d', 'hex').toString()) {
                        if (data == 'quit') {
                            session.end();
                            session.close();
                            client.end();
                        } else {
                            shell.write(`\nTu ${data}`);
                            shell.write(prefix, 'ascii', (err) => {
                                console.log(err);
                            });
                            data = '';
                        }
                    } else {
                        data += chunk;
                    }
                })
            });
            session.on('pty', (accept, reject, info) => {
                console.log(info);
                accept();
            });
            session.on('sftp', (accept, reject) => {
                console.log('Client SFTP session');
                const openFiles = new Map();
                let handleCount = 0;
                const sftp = accept();
                sftp.on('OPEN', (reqid, filename, flags, attrs) => {
                    // Only allow opening /tmp/foo.txt for writing
                    if (filename !== '/tmp/foo.txt' || !(flags & OPEN_MODE.WRITE))
                        return sftp.status(reqid, STATUS_CODE.FAILURE);

                    // Create a fake handle to return to the client, this could easily
                    // be a real file descriptor number for example if actually opening
                    // a file on disk
                    const handle = Buffer.alloc(4);
                    openFiles.set(handleCount, true);
                    handle.writeUInt32BE(handleCount++, 0);

                    console.log('Opening file for write')
                    sftp.handle(reqid, handle);
                }).on('WRITE', (reqid, handle, offset, data) => {
                    if (handle.length !== 4
                        || !openFiles.has(handle.readUInt32BE(0))) {
                        return sftp.status(reqid, STATUS_CODE.FAILURE);
                    }

                    // Fake the write operation
                    sftp.status(reqid, STATUS_CODE.OK);

                    console.log('Write to file at offset ${offset}: ${inspect(data)}');
                }).on('CLOSE', (reqid, handle) => {
                    let fnum;
                    if (handle.length !== 4
                        || !openFiles.has(fnum = handle.readUInt32BE(0))) {
                        return sftp.status(reqid, STATUS_CODE.FAILURE);
                    }

                    console.log('Closing file');
                    openFiles.delete(fnum);

                    sftp.status(reqid, STATUS_CODE.OK);
                });
            });
        });
    }).on('close', () => {
        console.log('Client disconnected');
    });
}).
    listen(2127, '192.1.150.14', function () {
        console.log('Listening on port ' + this.address().port);
    });