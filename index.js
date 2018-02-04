
const net = require("net");
const EventEmitter = require("events");

function NetstringError(err) {
    this.err = err;
}

function parseNetstring(buf) {
    // Parse netstring at beginning of buf
    // A netstring is a chunk of bytes with the simplest thinkable encapsulation:
    // Before the data chunk the data length is specified with ascii digits (decimal).
    // Then a colon, the data chunk, and finally a comma that marks the end of the data.
    //
    // Example:
    //
    // "Hello" => "5:Hello,"
    // "Goodbye" => "7:Goodbye,"
    // "" => "0:,"
    //
    // This function parse a netstring at the start of 'buf' and returns
    // two values: the payload and the number of bytes consumed:
    //
    // parseNetstring("5:Hello,") -> [ "Hello", 8 ]
    // parseNetstring("7:Goodbye,") -> [ "Goodbye", 10]
    // parseNetstring("0:,") -> [ "", 3 ]
    //
    // If there is no complete netstring to consume null is returned:
    //
    // parseNetstring("5:Hel") -> [ null, 0 ]
    //
    // If the string is malformed an error is raised.
    const len = buf.length;

    // Trick from node-netstring package
    const charCode = (typeof buf === "string") ?
        (i) => buf[i].charCodeAt(0) :
        (i) => buf[i];

    if (len < 3) {
        return [null, 0];
    }

    let payloadLength = 0;

    for (i = 0; i < len; i++) {
        const c = charCode(i);

        if (c == 0x3a) {  // colon
            if (i == 0) {
                throw new NetstringError("no digits before colon");
            } else {
                i++;
                break;
            }
        }

        if (c >= 0x30 && c <= 0x39) {  // digits '0' to '9'
            payloadLength = payloadLength * 10 + c - 0x30;
        } else {
            throw new NetstringError("non-digits before colon");
        }
    }

    // No colon found. Incomplete.
    if (i == len) {
        return [null, 0];
    }

    if (i + payloadLength + 1 > len) {
        // Buffer does not hold the entire netstring
        return [null, 0];
    }

    if (charCode(i + payloadLength) != 0x2c) {
        // Netstring does not end with comma
        throw new NetstringError("does not end with comma");
    }

    return [buf.slice(i, i + payloadLength), i + payloadLength + 1];
}



class NetcomClient2 extends EventEmitter {
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

            this.buffer = this.buffer.slice(consumed);

            const response = JSON.parse(payload);
            this.emit("response", response);
        }
    }
}

//nc = new NetcomClient2();

//nc.connect()
//    .then(() => nc.upgradeToProto30())
//    .then(() => nc.getDeviceList());
    // .then(() => nc.read("sim1", ["3x0005", "3x0010"]))
    // .then((result) => console.log("Ok: ", result.toString("utf8")));


// class Pool {
//     acquire(cb) {

//     }
// }

class Pool extends EventEmitter {
    constructor() {
        super();
        const nc = new NetcomClient2();
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

const pool = new Pool();

function createConsumer(name, parameter, interval) {
    let busy = false;
    function consume() {
        if (busy) return;
        busy = true;

        console.log(`${name} begins`);
        pool.acquire(nc => {
            console.log(`${name} acquired connection`);
            nc.read("sim1", [parameter])
                .then(result => {
                    console.log(`${name} done: `, result[0]);
                    pool.release(nc);
                    busy = false;
                    return Promise.resolve();
                });
        });
    }

    setInterval(consume, interval);
}

createConsumer(" Ringo", "3x1000", 1200);
createConsumer("  Paul", "3x2000", 1200);
createConsumer("George", "3x3000", 1200);
createConsumer("Lennon", "3x4000", 1200);

module.exports = { NetcomClient2, parseNetstring };
