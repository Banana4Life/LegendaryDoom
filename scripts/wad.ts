
function readString(encoding: string): (buf: Uint8Array, x: number, y: number) => String {
    let encoder = new TextDecoder(encoding)
    return (buf, offset, length) => {
        let slice = buf.slice(offset, offset + length)
        return encoder.decode(slice);
    };
}

function readU32LE(buf: Uint8Array, at: number): number {
    console.log(buf[at], buf[at + 1], buf[at + 2], buf[at + 3])
    return (buf[at + 3] << 24) | (buf[at + 2] << 16) | (buf[at + 1] << 8) | buf[at]
}