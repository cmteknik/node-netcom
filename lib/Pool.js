
const EventEmitter = require('events');
const Client = require('./Client');

class Pool extends EventEmitter {
    constructor(address = 'localhost', port = 7878, clientInfo = null, maxClients = 3) {
        super();
        this.maxClients = 3;
        this.address = address;
        this.port = port;
        this.clientInfo = clientInfo;
        this.maxClients = maxClients;
        this.clients = [];
        this.idle = [];
    }

    formatClientInfo(n) {
        if (this.maxClients === 1) {
            return this.clientInfo;
        }

        return `${this.clientInfo} ${n}/${this.maxClients}`;
    }

    newClient() {
        if (this.clients.length < this.maxClients) {
            const nc = new Client();
            this.clients.push(nc);
            const name = this.formatClientInfo(this.clients.length);
            console.log(`${name} appended to clients...`);

            nc.on('closed', this.onClientClosed.bind(this));

            nc.connect(this.address, this.port)
                .then(() => nc.upgradeToProto30())
                .then(() => nc.clientInfo(name))
                .then(() => nc.getDeviceList())
                .then(() => { this.idle.push(nc); this.emit('released'); });
        }
    }

    onClientClosed(client) {
        const idx = this.clients.indexOf(client);

        if (idx < 0) {
            console.error('Closed client was not in client list');
        } else {
            this.clients.splice(idx, 1);
        }
    }

    acquire() {
        return new Promise((resolve, reject) => {
            const waitForResource = () => {
                const resource = this.idle.pop();

                if (resource === undefined) {
                    console.log('Waiting for Netcom client to be released. In queue: ', this.listenerCount('released'));
                    this.once('released', waitForResource);
                    this.newClient();
                } else {
                    resolve(resource);
                }
            };
            waitForResource();
        });
    }

    release(resource) {
        this.idle.push(resource);
        this.emit('released');
    }

    disconnect() {
        this.clients.forEach(client => client.disconnect());
        this.idle.length = 0;
    }
}

module.exports = Pool;
