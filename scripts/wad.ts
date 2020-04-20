type StringReader = (buf: Uint8Array, offset: number, length: number) => string

function readString(encoding: string): StringReader {
    let encoder = new TextDecoder(encoding)
    return (buf, offset, length) => {
        let end = offset + length
        while (buf[end - 1] === 0) {
            end--
        }
        let slice = buf.slice(offset, end)
        return encoder.decode(slice)
    }
}

const readASCIIString = readString("ASCII")

function readI16LE(buf: Uint8Array, at: number): number {
    let n = readU16LE(buf, at)
    if ((n >> 15) == 0) {
        return n
    } else {
        return n | 0xFFFF0000
    }
}

function readU16LE(buf: Uint8Array, at: number): number {
    return (buf[at + 1] << 8) | buf[at]
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
        this.type = type
        this.lumpCount = lumpCount
        this.dictionaryPointer = dictionaryPointer
    }
}

class WAD {
    readonly header: WADHeader
    readonly dictionary: WADDictionary

    constructor(header: WADHeader, dictionary: WADDictionary) {
        this.header = header
        this.dictionary = dictionary
    }
}

class WADLump {
    static readonly NameLength = 8
    static readonly StructSize = 16

    readonly name: string
    readonly data: Uint8Array

    constructor(name: string, data: Uint8Array) {
        this.name = name
        this.data = data
    }
}

type WADDictionary = WADLump[]

function parseWad(file: File): Promise<WAD> {
    return file.arrayBuffer().then(buf => {
        let memory = new Uint8Array(buf)
        return parseHeader(memory, 0).then(header => {
            let dict = parseDictionary(memory, header.dictionaryPointer, header.lumpCount)
            return new WAD(header, dict)
        })
    })
}

function parseHeader(buf: Uint8Array, offset: number): Promise<WADHeader> {
    let type = readASCIIString(buf, offset, 4)
    if (type == "IWAD" || type == "PWAD") {
        let lumpCount = readU32LE(buf, 4)
        let dictPointer = readU32LE(buf, 8)
        return Promise.resolve(new WADHeader(<WADType>type, lumpCount, dictPointer))
    } else {
        return Promise.reject(`Broken WAD file or unknown WAD type: ${type}`)
    }
}

function parseDictionary(buf: Uint8Array, offset: number, lumpCount: number): WADDictionary {
    let dict: WADDictionary = []

    for (let i = 0; i < lumpCount; ++i) {
        let lumpOffset = offset + (i * WADLump.StructSize)
        let dataPointer = readU32LE(buf, lumpOffset)
        let dataLength = readU32LE(buf, lumpOffset + 4)
        let name = readASCIIString(buf, lumpOffset + 8, WADLump.NameLength)

        dict.push(new WADLump(name, buf.slice(dataPointer, dataPointer + dataLength)))
    }

    return dict
}