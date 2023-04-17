module.exports = (client, session) => {
    return function (accept, reject) {
        const shell = accept();
        const prefix = "\r\nHacker's Den: ";
        shell.write(prefix, 'ascii', (err) => {
            console.log(err);
        });
        shell.read();
        let data = '';
        shell.addListener('data', (chunk) => {
            shell.write(chunk);
            if (chunk.toString() === Buffer.from('7f', 'hex').toString()) {
                if (data.length > 0) {
                    shell.write('\b \b');
                    data = data.substring(0, data.length - 1);
                }
            } else if (chunk.toString() === Buffer.from('0d', 'hex').toString()) {
                if (data == 'quit') {
                    session.end();
                    session.close();
                    client.end();
                } else {
                    shell.write('\r\nYou send: ' + data);
                    shell.write(prefix, 'ascii', (err) => {
                        console.log(err);
                    });
                    data = '';
                }
            } else {
                data += chunk;
            }
        });

        shell.addListener('error', (shellError) => {
            console.log('Shell error: '+shellError);
        });
    };
}