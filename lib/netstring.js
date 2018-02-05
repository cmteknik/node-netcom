
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

module.exports = { parseNetstring, NetstringError }
