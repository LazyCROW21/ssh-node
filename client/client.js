require('dotenv').config();
const { Client } = require('ssh2');
const { readFileSync } = require('fs');
const { OPEN_MODE } = require('ssh2/lib/protocol/SFTP');

const conn = new Client();
conn.on('error', (connError) => {
    console.log('Error at connection level');
    console.log(connError);
});
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.sftp((err, sftp) => {
        if (err) {
            console.log("SFTP protocol eror");
            return console.log(err);
        }

        // let writeOperationComplete = false;
        // console.log('Opening file to write!');
        // sftp.open('/home/hardik/Desktop/wClient.txt', OPEN_MODE.WRITE, (err, handle) => {
        //     if (err) {
        //         return console.log('File open error', err);
        //     }
        //     // console.log(handle);
        //     const buffer = Buffer.from('Hello server');
        //     sftp.write(handle, buffer, 0, buffer.length, 0, (err) => {
        //         writeOperationComplete = true;
        //         if (err) {
        //             return console.log('Write error: ', err);
        //         }
        //         console.log('Write complete');
                // sftp.close(handle, (err) => {
                //     if (err) {
                //         return console.log('Close error: ', err);
                //     }
                //     console.log('Closed');
                //     sftp.end();
                //     conn.end();
                // });
        //     });
        // });
        // while(!writeOperationComplete) {
        //     // do nothing, wait
        // }

        console.log('Opening file to read data from');
        sftp.open('/home/hardik/Desktop/rClient.txt', OPEN_MODE.READ, (err, handle) => {
            if (err) {
                return console.log('File open error', err);
            }
            // console.log(handle);
            const buffer = Buffer.alloc(16);
            sftp.read(handle, buffer, 0, buffer.length, 0, (err, bytesRead, buffer, pos) => {
                if (err) {
                    return console.log('Read error: ', err);
                }
                console.log('Read complete');
                console.log(bytesRead, buffer, pos);
                console.log(buffer.toString());
                // sftp.close(handle, (err) => {
                //     if (err) {
                //         return console.log('Close error: ', err);
                //     }
                //     console.log('Closed');
                //     sftp.end();
                //     conn.end();
                // });
            });
        });
    });
}).connect({
    privateKey: readFileSync('/home/hardik/.ssh/id_rsa'),
    // debug: (message) => console.log(message),
    host: 'localhost',
    port: 2127,
    username: 'foo',
    password: 'bar',
    passphrase: 'bar',
    tryKeyboard: true
});
