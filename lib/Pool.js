
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

    newClient(onError) {
        // This function attempts to connect a new client
        // unless the max number of active clients is reached.
        //
        // If the max client count is reached, it returns immediately.
        //
        // Otherwise a new Client instance is created and a
        // promise is created that establishes a connection.
        // Once the connection is established the Client instance
        // is added to the "idle" list and a "released" event
        // is emitted.
        //
        // If an error occurs while connecting the "onError"
        // callback is called.
        if (this.clients.length < this.maxClients) {
            const nc = new Client();
            this.clients.push(nc);

            const name = this.formatClientInfo(this.clients.length);
            console.log(`${name} appended to clients...`);

            const errorWhileConnecting = (error) => {
                this.dropClient(nc);
                onError(error);
            };

            nc.on('error', errorWhileConnecting);

            nc.connect(this.address, this.port)
                .then(() => nc.upgradeToProto30())
                .then(() => nc.clientInfo(name))
                .then(() => nc.getDeviceList())
                .then(() => {
                    this.idle.push(nc);
                    nc.removeListener('error', errorWhileConnecting);
                    nc.on('closed', this.onClientClosed.bind(this));
                    this.emit('released');
                });
        }
    }

    dropClient(client) {
        const idx = this.clients.indexOf(client);
        if (idx >= 0) {
            this.clients.splice(idx, 1);
        }
    }

    onClientClosed(client) {
        console.log('Pool: onClientClosed');
        this.dropClient(client);
    }

    acquire() {
        return new Promise((resolve, reject) => {
            const waitForResource = () => {
                const resource = this.idle.pop();

                if (resource === undefined) {
                    console.log('Waiting for Netcom client to be released. In queue: ', this.listenerCount('released'));
                    this.once('released', waitForResource);
                    this.newClient((error) => {
                        this.removeListener('released', waitForResource);
                        reject(error);
                    });
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
