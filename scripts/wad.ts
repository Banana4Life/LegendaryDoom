
type StringReader = (buf: Uint8Array, offset: number, length: number) => string
function readString(encoding: string): StringReader {
    let encoder = new TextDecoder(encoding)
    return (buf, offset, length) => {
        let end = offset + length
        while (buf[end - 1] === 0) {
            end--;
        }
        let slice = buf.slice(offset, end)
        return encoder.decode(slice);
    };
}

function readU32LE(buf: Uint8Array, at: number): number {
    return (buf[at + 3] << 24) | (buf[at + 2] << 16) | (buf[at + 1] << 8) | buf[at]
}

type WADType = "IWAD" | "PWAD"

class WADHeader {
    readonly type: WADType
    readonly lumpCount: number
    readonly dictionaryPointer: number

    constructor(type: WADType, lumpCount: number, dictionaryPointer: number) {
        this.type = type;
        this.lumpCount = lumpCount;
        this.dictionaryPointer = dictionaryPointer;
    }
}

class WAD {
    static readonly FileMimeType = "application/x-doom-wad"

    readonly header: WADHeader
    readonly dictionary: WADDictionary

    constructor(header: WADHeader, dictionary: WADDictionary) {
        this.header = header
        this.dictionary = dictionary
    }

    getLump(name: string): WADLump | undefined {
        return this.dictionary.get(name)
    }
}

class WADLump {
    static readonly StructSize = 16

    readonly name: string
    readonly data: Uint8Array

    constructor(name: string, data: Uint8Array) {
        this.name = name;
        this.data = data;
    }
}

type WADDictionary = Map<string, WADLump>

function parseWad(file: File): Promise<WAD> {
    if (file.type !== WAD.FileMimeType) {
        return Promise.reject(`Unsupported mime type! Requires: ${WAD.FileMimeType}, but was ${file.type}`)
    }
    let readASCIIString = readString("ASCII")
    return file.arrayBuffer().then(buf => {
        let memory = new Uint8Array(buf)
        return parseHeader(memory, 0, readASCIIString).then(header => {
            let dict = parseDictionary(memory, header.dictionaryPointer, header.lumpCount, readASCIIString)
            return new WAD(header, dict)
        })
    })
}

function parseHeader(buf: Uint8Array, offset: number, stringReader: StringReader): Promise<WADHeader> {
    let type = stringReader(buf, offset, 4)
    if (type == "IWAD" || type == "PWAD") {
        let lumpCount = readU32LE(buf, 4)
        let dictPointer = readU32LE(buf, 8)
        return Promise.resolve(new WADHeader(<WADType>type, lumpCount, dictPointer))
    } else {
        return Promise.reject(`Broken WAD file or unknown WAD type: ${type}`)
    }
}

function parseDictionary(buf: Uint8Array, offset: number, lumpCount: number, stringReader: StringReader): WADDictionary {
    let dict: WADDictionary = new Map<string, WADLump>();

    for (let i = 0; i < lumpCount; ++i) {
        let lumpOffset = offset + (i * WADLump.StructSize)
        let dataPointer = readU32LE(buf, lumpOffset)
        let dataLength = readU32LE(buf, lumpOffset + 4)
        let name = stringReader(buf, lumpOffset + 8, 8)

        dict.set(name, new WADLump(name, buf.slice(dataPointer, dataPointer + dataLength)))
    }

    return dict
}