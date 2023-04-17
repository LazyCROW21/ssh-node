require("dotenv").config();
const { Server } = require("ssh2");
const { readFileSync } = require("fs");
const { timingSafeEqual } = require("crypto");
const { inspect } = require("util");
const { OPEN_MODE, STATUS_CODE, flagsToString } = require('ssh2/lib/protocol/SFTP');

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
        debug: (message) => console.log(message),
        hostKeys: [readFileSync("/etc/ssh/ssh_host_rsa_key")],
    },
    (client, clientInfo) => {
        console.log("Client connected!");
        client.on("error", (error) => {
            console.log(error);
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
                console.log("Client authenticated!");
                client.on("session", (accept, reject) => {
                    const session = accept();
                    session.on("shell", shellHandler(client, session));
                    session.on("pty", (accept, reject, info) => {
                        console.log(info);
                        accept();
                    });
                    session.on("sftp", (accept, reject) => {
                        console.log("Client SFTP session");
                        const openFiles = new Map();
                        let handleCount = 0;
                        const sftp = accept();
                        sftp.on("OPEN", (reqid, filename, flags, attrs) => {
                            // if (filename !== "/home/hardik/Desktop/wClient.txt" || filename !== "/home/hardik/Desktop/rClient.txt") {
                            //     return sftp.status(reqid, STATUS_CODE.FAILURE);
                            // }
                            console.log(filename, flagsToString(flags), attrs);
                            const handle = Buffer.alloc(4);
                            openFiles.set(handleCount, true);
                            handle.writeUInt32BE(handleCount++, 0);
                            console.log("Opening file for write");
                            sftp.handle(reqid, handle);
                        });
                        sftp.on("READ", (reqid, handle, offset, len) => {
                            if (
                                handle.length !== 4 ||
                                !openFiles.has(handle.readUInt32BE(0))
                            ) {
                                return sftp.status(reqid, STATUS_CODE.FAILURE);
                            }

                            // Fake the read operation
                            console.log(data);
                            sftp.data(reqid, 'Hello client');
                            sftp.status(reqid, STATUS_CODE.EOF);

                            console.log(
                                `Read to file at offset ${offset}, length: ${len}`
                            );
                        });
                        sftp.on("WRITE", (reqid, handle, offset, data) => {
                            if (
                                handle.length !== 4 ||
                                !openFiles.has(handle.readUInt32BE(0))
                            ) {
                                return sftp.status(reqid, STATUS_CODE.FAILURE);
                            }

                            // Fake the write operation
                            console.log(data);
                            sftp.status(reqid, STATUS_CODE.OK);

                            console.log(
                                `Write to file at offset ${offset}: ${inspect(data)}`
                            );
                        });
                        sftp.on("CLOSE", (reqid, handle) => {
                            let fnum;
                            if (
                                handle.length !== 4 ||
                                !openFiles.has((fnum = handle.readUInt32BE(0)))
                            ) {
                                return sftp.status(reqid, STATUS_CODE.FAILURE);
                            }

                            console.log("Closing file");
                            openFiles.delete(fnum);

                            sftp.status(reqid, STATUS_CODE.OK);
                        });
                    });
                });
            })
            .on("close", () => {
                console.log("Client disconnected");
            });
    }
).listen(process.env.SERVER_PORT, process.env.SERVER_IPV4_ADDRESS, function () {
    console.log("Listening on port " + this.address().port);
});
