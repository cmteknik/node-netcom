
const EventEmitter = require("events");
const Client = require("./Client");

class Pool extends EventEmitter {
    constructor() {
        super();
        const nc = new Client();
        nc.connect()
            .then(() => nc.upgradeToProto30())
            .then(() => nc.getDeviceList());
        this.idle = [nc];
    }

    acquire(acquiredCallback) {
        const waitForResource = () => {
            const resource = this.idle.pop();
            if (resource === undefined) {
                this.once("released", waitForResource);
            } else {
                acquiredCallback(resource);
            }
        }
        waitForResource();
    }

    release(resource) {
        this.idle.push(resource);
        this.emit("released");
    }
}

module.exports = Pool;