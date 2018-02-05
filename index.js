
const Pool = require("./lib/Pool");
const Client = require("./lib/Client");
const { parseNetstring, NetstringErro } = require("./lib/netstring");

module.exports = { Client, Pool, parseNetstring };
