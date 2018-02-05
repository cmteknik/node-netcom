
const assert = require("assert");

const { parseNetstring, Client } = require("../index.js");

describe("parseNetstring", () => {
    const parse = parseNetstring;

    it("should return null if less than three bytes", () => {
        assert.deepEqual([null, 0], parse(""));
        assert.deepEqual([null, 0], parse("0"));
        assert.deepEqual([null, 0], parse("0:"));
    });

    it("should throw if non-digits before colon", () => {
        assert.doesNotThrow(() => parse("11:"));
        assert.throws(() => parse("1X:"));
    });

    it("should throw if no digits before colon", () => {
        assert.throws(() => parse(":abc,"));
    });

    it("should return null if not enough data", () => {
        assert.deepEqual([null, 0], parse("5:abc"));
        assert.deepEqual([null, 0], parse("5:abcd"));
        assert.deepEqual([null, 0], parse("5:abcde")); 
    });

    it("should throw if last character is not a comma", () => {
        assert.throws(() => parse("5:abcde!"));
    });

    it("should return payload and offset if data is valid and complete", () => {
        assert.deepEqual(["abcde", 8], parse("5:abcde,"));
        assert.deepEqual(["", 3], parse("0:,"));
        assert.deepEqual(["abcdefghijklmnop", 20], parse("16:abcdefghijklmnop,"));
    });
});

describe("Client", () => {
    it("should handle netstring received in one complete chunk", () => {
        const responses = [];
        const nc = new Client();
        nc.on("response", (data) => responses.push(data));
        nc.onData('10:{"x": "y"},');
        assert.deepEqual([{x: "y"}], responses);
    });

    it("should handle netstrings received in parts", () => {
        let responses = [];
        const nc = new Client();
        nc.on("response", (data) => responses.push(data));

        nc.onData('19:{"a":1');
        assert.equal(0, responses.length);

        nc.onData('23,"boo"')
        assert.equal(0, responses.length);

        nc.onData(':200');
        nc.onData('},13:{"1":2,"3":4},');
        assert.deepEqual([ { a: 123, boo: 200 }, {"1": 2, "3": 4}], responses);
    })
});