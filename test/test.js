
const assert = require("assert");

const { parseNetstring, NetcomClient2 } = require("../index.js");

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

describe("NetcomClient2", () => {
    it("should handle netstring received in one complete chunk", () => {
        const responses = [];
        const nc = new NetcomClient2();
        nc.on("response", (data) => responses.push(data.toString("utf8")));
        nc.onData("6:abcdef,");
        assert.deepEqual(["abcdef"], responses);
    });

    it("should handle netstrings received in parts", () => {
        let responses = [];
        const nc = new NetcomClient2();
        nc.on("response", (data) => responses.push(data.toString("utf8")));

        nc.onData("6:abcd");
        assert.equal(0, responses.length);

        nc.onData("ef,")
        assert.deepEqual(["abcdef"], responses);

        responses = [];
        nc.onData("2:AB,2:CD,4:EF");
        nc.onData("GH,3:IJK,2:LM");
        assert.deepEqual(["AB","CD","EFGH","IJK"], responses);
    })
});