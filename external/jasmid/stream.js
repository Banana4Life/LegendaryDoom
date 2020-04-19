/* Wrapper for accessing strings through sequential reads */
function ByteStream(data) {
    var position = 0;

    function read(length) {
        let decodedSlice = new TextDecoder("ASCII").decode(data.slice(position, position + length));
        position += length;
        return decodedSlice;
    }

    function readChunk(length) {
        let slice = data.slice(position, position + length)
        position += length;
        return slice;
    }

    /* read a big-endian 32-bit integer */
    function readInt32() {
        var result = (
            (data[position] << 24)
            + (data[position + 1] << 16)
            + (data[position + 2] << 8)
            + data[position + 3]);
        position += 4;
        return result;
    }

    /* read a big-endian 16-bit integer */
    function readInt16() {
        var result = (
            (data[position] << 8)
            + data[position + 1]);
        position += 2;
        return result;
    }

    /* read an 8-bit integer */
    function readInt8(signed) {
        var result = data[position];
        if (signed && result > 127) result -= 256;
        position += 1;
        return result;
    }

    function eof() {
        return position >= data.length;
    }

    /* read a MIDI-style variable-length integer
        (big-endian value in groups of 7 bits,
        with top bit set to signify that another byte follows)
    */
    function readVarInt() {
        var result = 0;
        while (true) {
            var b = readInt8();
            if (b & 0x80) {
                result += (b & 0x7f);
                result <<= 7;
            } else {
                /* b is the last byte */
                return result + b;
            }
        }
    }

    function pos() {
        return position;
    }

    return {
        'eof': eof,
        'read': read,
        'readChunk': readChunk,
        'readInt32': readInt32,
        'readInt16': readInt16,
        'readInt8': readInt8,
        'readVarInt': readVarInt
    }
}