
const net = require('net');
const EventEmitter = require('events');

const { parseNetstring } = require('./netstring');

class Client extends EventEmitter {
    constructor(name = undefined) {
        super();
        this.name = name;
        this.client = null;
        this.buffer = null;
    }

    connect(address = 'localhost', port = 7878) {
        this.client = new net.Socket();

        this.client.on('close', this.onClose.bind(this));
        this.client.on('end', this.onEnd.bind(this));
        this.client.on('error', this.onError.bind(this));
        this.client.on('data', this.onData.bind(this));

        return new Promise((resolve) => {
            this.client.connect(port, address, () => resolve());
        });
    }

    disconnect() {
        this.client.destroy();
    }

    onClose(hadError) {
        console.log('Client: onClose');
        this.emit('closed', this);
    }

    onEnd() {
        // We don't need to do anything: the close event
        // will always be emitted after this event.
    }

    onError(error) {
        console.log('Client: onError');
        this.emit('error', error);
    }

    sendRequest(req) {
        const json = JSON.stringify(req);
        const netstring = `${json.length}:${json},`;
        this.client.write(netstring);
    }

    // Helper method that waits for a 'response' event.
    // If an error happens before a 'response' event
    // is received the failure callback is called instead.
    waitForResponse(successCallback, failureCallback) {
        let onClosedCB;

        const onResponseCB = (response) => {
            this.removeListener('closed', onClosedCB);
            successCallback(response);
        };

        onClosedCB = () => {
            this.removeListener('response', onResponseCB);
            failureCallback();
        };

        this.once('response', onResponseCB);
        this.once('closed', onClosedCB);
    }

    implUpgradeToProto30(successCallback, failureCallback) {
        this.once('response', (response) => {
            successCallback();
        });

        this.client.write('PROTO30\n');
    }

    upgradeToProto30() {
        return new Promise((resolve, reject) => {
            this.implUpgradeToProto30(resolve, reject);
        });
    }

    clientInfo(name) {
        this.name = name;

        return new Promise((resolve, reject) => {
            this.sendRequest({ r: 'client-info', name });
            this.waitForResponse(resolve, reject);
        });
    }

    getDeviceList() {
        return new Promise((resolve, reject) => {
            this.sendRequest({ r: 'device-list' });
            this.waitForResponse(resolve, reject);
        });
    }

    read(device, parameters) {
        // TODO: validate content of parameters
        return new Promise((resolve, reject) => {
            this.sendRequest({ r: 'read', device, p: parameters });
            this.waitForResponse(
                (response) => {
                    if (response.error) {
                        reject(response);
                    } else {
                        console.log(response);
                        resolve(response.result);
                    }
                },
                () => { reject(); }
            );
        });
    }

    write(device, parameters) {
        return new Promise((resolve, reject) => {
            this.sendRequest({ r: 'write', device, p: parameters });
            this.waitForResponse(
                (response) => {
                    if (response.error) {
                        reject(response);
                    } else {
                        resolve(response.result);
                    }
                },
                () => { reject(); }
            );
        });
    }

    onData(data) {
        if (typeof data === 'string') {
            data = Buffer.from(data, 'utf8');
        }

        if (this.buffer === null) {
            this.buffer = data;
        } else {
            this.buffer = Buffer.concat([this.buffer, data]);
        }

        let payload;
        let consumed;

        while (this.buffer.length > 0) {
            try {
                [payload, consumed] = parseNetstring(this.buffer);
            } catch (e) {
                console.log('Invalid netstring: ', e);
                this.disconnect();
                return;
            }

            if (payload === null) {
                return;
            }

            if (this.buffer) {
                this.buffer = this.buffer.slice(consumed);
            }

            try {
                const response = JSON.parse(payload);
                this.emit('response', response);
            } catch (e) {
                console.log('Invalid JSON: ', e);
                this.disconnect();
                return;
            }
        }
    }
}

module.exports = Client;
