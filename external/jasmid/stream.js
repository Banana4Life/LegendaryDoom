/* Wrapper for accessing strings through sequential reads */
class ByteStream {
    position = 0
    data

    constructor(data) {
        this.data = data;
    }

    read(length) {
        return new TextDecoder("ASCII").decode(this.readChunk(length));
    }

    readChunk(length) {
        let slice = this.data.slice(this.position, this.position + length)
        this.position += length;
        return slice;
    }

    /* read a big-endian 32-bit integer */
    readInt32() {
        var result = (
            (this.data[this.position] << 24)
            + (this.data[this.position + 1] << 16)
            + (this.data[this.position + 2] << 8)
            + this.data[this.position + 3]);
        this.position += 4;
        return result;
    }

    /* read a big-endian 16-bit integer */
    readInt16() {
        var result = (
            (this.data[this.position] << 8)
            + this.data[this.position + 1]);
        this.position += 2;
        return result;
    }

    /* read an 8-bit integer */
    readInt8(signed) {
        var result = this.data[this.position];
        if (signed && result > 127) result -= 256;
        this.position += 1;
        return result;
    }

    eof() {
        return this.position >= this.data.length;
    }

    /* read a MIDI-style variable-length integer
        (big-endian value in groups of 7 bits,
        with top bit set to signify that another byte follows)
    */
    readVarInt() {
        var result = 0;
        while (true) {
            var b = this.readInt8();
            if (b & 0x80) {
                result += (b & 0x7f);
                result <<= 7;
            } else {
                /* b is the last byte */
                return result + b;
            }
        }
    }
}