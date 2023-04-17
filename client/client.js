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
        sftp.open('/home/hardik/Desktop/wClient.txt', OPEN_MODE.WRITE, (err, handle) => {
            if(err) {
                return console.log('File open error', err);
            }
            console.log(handle);
            sftp.writeFile('/home/hardik/Desktop/wClient.txt', 'hello from the other side', (err) => {
                if (err) {
                    return console.log('Write error: ', err);
                }
                console.log('Uploaded');
                sftp.close(handle, (err) => {
                    if (err) {
                        return console.log('Close error: ', err);
                    }
                    console.log('Closed');
                    sftp.end();
                    conn.end();
                });
            });
            sftp.readFile('/home/hardik/Desktop/rClient.txt', { encoding: 'utf-8', flag: OPEN_MODE.READ }, (err) => {
                if (err) {
                    return console.log('Write error: ', err);
                }
                console.log('Uploaded');
                sftp.close(handle, (err) => {
                    if (err) {
                        return console.log('Close error: ', err);
                    }
                    console.log('Closed');
                    sftp.end();
                    conn.end();
                });
            });
        });
    });
}).connect({
    privateKey: readFileSync('/home/hardik/.ssh/id_rsa'),
    debug: (message) => console.log(message),
    host: 'localhost',
    port: 2127,
    username: 'foo',
    password: 'bar',
    passphrase: 'bar',
    tryKeyboard: true
});
