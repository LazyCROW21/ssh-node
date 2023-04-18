require("dotenv").config();
const { Server } = require("ssh2");
const { writeFileSync, readFileSync } = require("fs");
const { timingSafeEqual } = require("crypto");
const { inspect } = require("util");
const { OPEN_MODE, STATUS_CODE, flagsToString } = require('ssh2/lib/protocol/SFTP');
const { serverStreamLogger, writeStreamLogger } = require('./server_logger');

const shellHandler = require("./shell_handler");

const allowedUser = Buffer.from("foo");
const allowedPassword = Buffer.from("bar");

function checkValue(input, allowed) {
    const autoReject = input.length !== allowed.length;
    if (autoReject) {
        // Prevent leaking length information by always making a comparison with the
        // same input when lengths don't match what we expect ...
        allowed = input;
    }
    const isMatch = timingSafeEqual(input, allowed);
    return !autoReject && isMatch;
}

new Server(
    {
        // debug: (message) => {
        //     serverStreamLogger.log('info', message);
        // },
        hostKeys: [readFileSync("/etc/ssh/ssh_host_rsa_key")],
    },
    (client, clientInfo) => {
        console.log("Client connected!");
        serverStreamLogger.log('error', {
            clientInfo,
            message: 'Client conneceted'
        });
        client.on("error", (error) => {
            console.log(error);
            serverStreamLogger.log('error', {
                clientInfo,
                message: 'Client error',
                error
            });
        });
        client
            .on("authentication", (ctx) => {
                console.log("Trying to auth");
                let allowed = true;
                if (!checkValue(Buffer.from(ctx.username), allowedUser))
                    allowed = false;

                switch (ctx.method) {
                    case "password":
                        if (!checkValue(Buffer.from(ctx.password), allowedPassword))
                            return ctx.reject();
                        break;
                    default:
                        return ctx.reject();
                }

                if (allowed) ctx.accept();
                else ctx.reject();
            })
            .on("ready", () => {
                serverStreamLogger.log('info', {
                    clientInfo,
                    message: 'Client authenticated',
                });
                client.on("session", (accept, reject) => {
                    const session = accept();
                    serverStreamLogger.log('info', {
                        clientInfo,
                        message: 'Client session started'
                    });
                    session.on("shell", shellHandler(client, session));
                    session.on("pty", (accept, reject, info) => {
                        console.log(info);
                        accept();
                    });
                    // Currently supported commands open, close, read, write
                    session.on("sftp", (accept, reject) => {
                        const sftp = accept();
                        serverStreamLogger.log('info', {
                            clientInfo,
                            message: 'Client SFTP session'
                        });
                        const openFiles = new Map();
                        const openFilePaths = new Map();
                        const openFileModes = new Map();
                        let handleCount = 0;
                        sftp.on("OPEN", (reqid, filename, flags, attrs) => {
                            // Directory access
                            // We can also move the base directory of server by prefixing every filename with particular address
                            // eg: /hello.txt -> (add prefexx '/home/Argus/Desktop') -> /home/Argus/Desktop/hello.txt
                            if (!filename.startsWith("/home/hardik/Desktop/")) {
                                return sftp.status(reqid, STATUS_CODE.PERMISSION_DENIED);
                            }
                            serverStreamLogger.log('info', {
                                clientInfo,
                                message: 'Client SFTP OPEN',
                                SFTP: {
                                    reqid,
                                    filename,
                                    flagsToString: flagsToString(flags),
                                    flags,
                                    attrs
                                }
                            });
                            const handle = Buffer.alloc(4);
                            openFiles.set(handleCount, true);
                            openFilePaths.set(handleCount, filename);
                            openFileModes.set(handleCount, flags);
                            handle.writeUInt32BE(handleCount++, 0);
                            console.log("Opening file for " + flagsToString(flags));
                            sftp.handle(reqid, handle);
                        });
                        sftp.on("READ", (reqid, handle, offset, len) => {
                            if (
                                handle.length !== 4 ||
                                !openFiles.has(handle.readUInt32BE(0))
                            ) {
                                return sftp.status(reqid, STATUS_CODE.FAILURE);
                            }

                            serverStreamLogger.log('info', {
                                clientInfo,
                                message: 'Client SFTP READ',
                                SFTP: {
                                    reqid,
                                    handle,
                                    len,
                                    offset
                                }
                            });

                            // read operation, ignoring return length/offset
                            sftp.data(reqid, readFileSync(
                                openFilePaths.get(
                                    handle.readUInt32BE(0)), 
                                    { flag: flagsToString(openFileModes.get(handle.readUInt32BE(0))) }
                                )
                            );
                            sftp.status(reqid, STATUS_CODE.EOF);
                        });
                        sftp.on("WRITE", (reqid, handle, offset, data) => {
                            if (
                                handle.length !== 4 ||
                                !openFiles.has(handle.readUInt32BE(0))
                            ) {
                                return sftp.status(reqid, STATUS_CODE.FAILURE);
                            }

                            // write operation, ignoring sent offset/position
                            try {
                                writeFileSync(openFilePaths.get(handle.readUInt32BE(0)), data, {
                                    mode: openFileModes.get(handle.readUInt32BE(0))
                                });
                            } catch (writeError) {
                                serverStreamLogger.log('error', {
                                    clientInfo,
                                    message: 'SFTP WRITE error',
                                    SFTP: {
                                        reqid,
                                        handle,
                                        inspect: inspect(data),
                                        offset
                                    },
                                    writeError
                                });
                                return sftp.status(reqid, STATUS_CODE.FAILURE);
                            }

                            // write success
                            sftp.status(reqid, STATUS_CODE.OK);
                            serverStreamLogger.log('info', {
                                clientInfo,
                                message: 'Client SFTP WRITE',
                                SFTP: {
                                    reqid,
                                    handle,
                                    inspect: inspect(data),
                                    offset
                                }
                            });
                        });
                        sftp.on("CLOSE", (reqid, handle) => {
                            let fnum;
                            if (
                                handle.length !== 4 ||
                                !openFiles.has((fnum = handle.readUInt32BE(0)))
                            ) {
                                return sftp.status(reqid, STATUS_CODE.FAILURE);
                            }

                            serverStreamLogger.log('info', {
                                clientInfo,
                                message: 'Client SFTP CLOSE',
                                SFTP: {
                                    reqid,
                                    handle
                                }
                            });
                            openFiles.delete(fnum);
                            openFilePaths.delete(fnum);
                            openFileModes.delete(fnum);
                            sftp.status(reqid, STATUS_CODE.OK);
                        });
                    });
                });
            })
            .on("close", () => {
                serverStreamLogger.log('info', {
                    clientInfo,
                    message: 'Client disconnected'
                });
            });
    }
).listen(process.env.SERVER_PORT, process.env.SERVER_IPV4_ADDRESS, function () {
    console.log("Listening on port " + this.address().port);
});
