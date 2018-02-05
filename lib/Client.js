
const net = require("net");
const EventEmitter = require("events");

const { parseNetstring, NetstringError } = require("./netstring");

class Client extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.buffer = null;
    }

    connect(address, port) {
        address = address || "localhost";
        port = port || 7878;

        this.client = new net.Socket();
        this.client.on("disconnect", this.onDisconnect.bind(this));
        this.client.on("error", this.onError.bind(this));
        this.client.on("data", this.onData.bind(this));

        return new Promise(resolve => {
            this.client.connect(port, address, () => resolve());
        });

        this.client = client;
    }

    sendRequest(req) {
        const json = JSON.stringify(req);
        const netstring = `${json.length}:${json},`;
        this.client.write(netstring);
    }

    implUpgradeToProto30(successCallback, failureCallback) {
        this.once("response", (response) => {
            successCallback();
        });

        this.client.write("PROTO30\n");
    }

    upgradeToProto30() {
        return new Promise((resolve, reject) => {
            this.implUpgradeToProto30(resolve, reject);
        });
    }

    implGetDeviceList(successCallback, failureCallback) {
        this.once("response", (response) => {
            successCallback();
        });

        this.sendRequest({ r: "device-list" });
    }

    getDeviceList() {
        return new Promise((resolve, reject) => {
            this.implGetDeviceList(resolve, reject);
        });
    }

    implRead(device, parameters, successCallback, failureCallback) {
        // TODO: validate content of parameters
        this.once("response", (response) => {
            successCallback(response["result"]);
        });

        this.sendRequest({ r: "read", device, "p": parameters });
    }

    read(device, parameters) {
        return new Promise((resolve, reject) => {
            this.implRead(device, parameters, resolve, reject);
        });
    }

    implWrite(device, parameters, successCallback, failureCallback) {
        this.once("response", (response) => {
            successCallback(response["result"]);
        });

        this.sendRequest({ r: "write", device, "p": parameters });
    }

    write(device, parameters) {
        return new Promise((resolve, reject) => {
            this.implWrite(device, parameters, resolve, reject);
        })
    }

    onDisconnect() {
        console.log("onDisconnect NOT IMPLEMENTED");
    }

    onError(e) {
        console.log("onError NOT IMPLEMENTED", e);
    }

    onData(data) {
        if (typeof data === "string")
            data = Buffer.from(data, "utf8")

        if (this.buffer === null) {
            this.buffer = data;
        } else {
            this.buffer = Buffer.concat([this.buffer, data]);
        }

        let payload, consumed;

        while (this.buffer.length > 0) {
            try {
                [payload, consumed] = parseNetstring(this.buffer);
            } catch (e) {
                console.log("Invalid netstring: ", e);
                this.buffer = null;
            }

            if (payload === null) {
                return;
            }

            if (this.buffer) {
                this.buffer = this.buffer.slice(consumed);
            }

            const response = JSON.parse(payload);
            console.log("RECEIVED RESPONSE", response);
            this.emit("response", response);
        }
    }
}

module.exports = Client