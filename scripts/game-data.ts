
class DoomGame {
    readonly wad: WAD
    readonly maps: DoomMap[]
    private readonly mapLookup: Map<DoomMapName, DoomMap>

    constructor(wad: WAD, maps: DoomMap[]) {
        this.wad = wad;
        this.maps = maps;
        this.mapLookup = new Map<DoomMapName, DoomMap>()
        for (let map of maps) {
            this.mapLookup.set(map.name, map)
        }
    }

    getMap(name: DoomMapName): DoomMap | undefined {
        return this.mapLookup.get(name)
    }

    getSound(name: string): DoomSound | null {
        let soundLumpName = `DS${name}`.toUpperCase()
        for (let lump of this.wad.dictionary) {
            if (lump.name === soundLumpName) {
                return DoomSound.parse(lump.data)
            }
        }
        return null
    }

    static parseMaps(wad: WAD): DoomMap[] {

        let originalName = /^(?:E(\d+)M(\d+))$/
        let laterName = /^MAP(\d+)$/

        function extractName(lump: WADLump): DoomMapName | null {
            let originalMatch = originalName.exec(lump.name)
            if (originalMatch !== null) {
                return {x: parseInt(originalMatch[1]), y: parseInt(originalMatch[2])}
            }

            let laterMatch = laterName.exec(lump.name)
            if (laterMatch !== null) {
                return {n: parseInt(laterMatch[1])}
            }

            return null
        }

        function findMaps(from: number, maps: DoomMap[]): DoomMap[] {

            if (from >= wad.dictionary.length) {
                return maps
            }

            let lump = wad.dictionary[from]
            let name = extractName(lump)
            if (name === null) {
                return findMaps(from + 1, maps)
            } else {
                maps.push(DoomMap.parse(wad, name, from))
                return findMaps(from + 1, maps)
            }
        }


        return findMaps(0, [])

    }

    static parse(wad: WAD): DoomGame {
        let maps = DoomGame.parseMaps(wad)

        return new DoomGame(wad, maps)
    }

}
type DoomMapName = {x: number, y: number} | {n: number}

class DoomMap {
    readonly name: DoomMapName
    readonly things: DoomThing[]
    readonly lineDefs: DoomLineDef[]
    readonly sideDefs: DoomSideDef[]
    readonly vertexes: DoomVertex[]
    readonly segments: DoomSegment[]
    readonly subSectors: DoomSubSector[]
    readonly nodes: DoomNode[]
    readonly sectors: DoomSector[]

    readonly blockMap: DoomBlockMap

    constructor(name: DoomMapName, things: DoomThing[], lineDefs: DoomLineDef[], sideDefs: DoomSideDef[], vertexes: DoomVertex[], segments: DoomSegment[], subSectors: DoomSubSector[], nodes: DoomNode[], sectors: DoomSector[], blockMap: DoomBlockMap) {
        this.name = name;
        this.things = things;
        this.lineDefs = lineDefs;
        this.sideDefs = sideDefs;
        this.vertexes = vertexes;
        this.segments = segments;
        this.subSectors = subSectors;
        this.nodes = nodes;
        this.sectors = sectors;
        this.blockMap = blockMap;
    }

    static parse(wad: WAD, name: DoomMapName, lumpOffset: number): DoomMap {
        let things = DoomMap.parseLump(wad, lumpOffset + 1, "THINGS", parsingAll(DoomThing.StructSize, DoomThing.parse))
        let lineDefs = DoomMap.parseLump(wad, lumpOffset + 2, "LINEDEFS", parsingAll(DoomLineDef.StructSize, DoomLineDef.parse))
        let sideDefs = DoomMap.parseLump(wad, lumpOffset + 3, "SIDEDEFS", parsingAll(DoomSideDef.StructSize, DoomSideDef.parse))
        let vertexes = DoomMap.parseLump(wad, lumpOffset + 4, "VERTEXES", parsingAll(DoomVertexSize, parseDoomVertex))
        let segments = DoomMap.parseLump(wad, lumpOffset + 5, "SEGS", parsingAll(DoomSegment.StructSize, DoomSegment.parse))
        let subSectors = DoomMap.parseLump(wad, lumpOffset + 6, "SSECTORS", parsingAll(DoomSubSector.StructSize, DoomSubSector.parse))
        let nodes = DoomMap.parseLump(wad, lumpOffset + 7, "NODES", parsingAll(DoomNode.StructSize, DoomNode.parse))
        let sectors = DoomMap.parseLump(wad, lumpOffset + 8, "SECTORS", parsingAll(DoomSector.StructSize, DoomSector.parse))
        // FIXME:
        // REJECT table at lumpOffset + 9
        let blockMap = DoomMap.parseLump(wad, lumpOffset + 10, "BLOCKMAP", DoomBlockMap.parse)

        return new DoomMap(name, things, lineDefs, sideDefs, vertexes, segments, subSectors, nodes, sectors, blockMap)
    }

    static parseLump<T>(wad: WAD, i: number, expectedLumpName: string, parser: (buf: Uint8Array) => T): T {
        let lump = wad.dictionary[i];
        if (lump.name !== expectedLumpName) {
            throw `Unexpected lump: expected ${expectedLumpName}, but was ${lump.name}`
        }
        return parser(lump.data)
    }
}

function parseAll<T>(buf: Uint8Array, structSize: number, parse: (buf: Uint8Array, i: number) => T): T[] {
    let all: T[] = []
    let size = buf.length
    for (let i = 0; i < size; i += structSize) {
        all.push(parse(buf, i))
    }
    return all
}

function parsingAll<T>(structSize: number, parse: (buf: Uint8Array, i: number) => T): (buf: Uint8Array) => T[] {
    return buf => {
        return parseAll(buf, structSize, parse)
    }
}

class DoomThing {
    static readonly StructSize = 10

    readonly x: number
    readonly y: number
    readonly angle: number
    readonly type: number
    readonly flags: number


    constructor(x: number, y: number, angle: number, type: number, flags: number) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.type = type;
        this.flags = flags;
    }

    static parse(buf: Uint8Array, i: number): DoomThing {
        return new DoomThing(
            readU16LE(buf, i),
            readU16LE(buf, i + 2),
            readU16LE(buf, i + 4),
            readU16LE(buf, i + 6),
            readU16LE(buf, i + 8)
        )
    }
}

class DoomLineDef {
    static readonly StructSize = 14

    readonly startVertexIndex: number
    readonly endVertexIndex: number
    readonly flags: number
    readonly specialType: number
    readonly sectorTag: number
    readonly rightSideDefIndex: number
    readonly leftSideDefIndex: number

    constructor(startVertexIndex: number, endVertexIndex: number, flags: number, specialType: number, sectorTag: number, rightSideDefIndex: number, leftSideDefIndex: number) {
        this.startVertexIndex = startVertexIndex;
        this.endVertexIndex = endVertexIndex;
        this.flags = flags;
        this.specialType = specialType;
        this.sectorTag = sectorTag;
        this.rightSideDefIndex = rightSideDefIndex;
        this.leftSideDefIndex = leftSideDefIndex;
    }

    static parse(buf: Uint8Array, i: number): DoomLineDef {
        return new DoomLineDef(
            readU16LE(buf, i),
            readU16LE(buf, i + 2),
            readU16LE(buf, i + 4),
            readU16LE(buf, i + 6),
            readU16LE(buf, i + 8),
            readU16LE(buf, i + 10),
            readU16LE(buf, i + 12)
        )
    }
}

class DoomSideDef {
    static readonly StructSize = 30

    readonly xOffset: number
    readonly yOffset: number
    readonly upperTextureName: string
    readonly lowerTextureName: string
    readonly middleTextureName: string
    readonly sectorIndex: number


    constructor(xOffset: number, yOffset: number, upperTextureName: string, lowerTextureName: string, middleTextureName: string, sectorIndex: number) {
        this.xOffset = xOffset;
        this.yOffset = yOffset;
        this.upperTextureName = upperTextureName;
        this.lowerTextureName = lowerTextureName;
        this.middleTextureName = middleTextureName;
        this.sectorIndex = sectorIndex;
    }

    static parse(buf: Uint8Array, i: number): DoomSideDef {
        return new DoomSideDef(
            readI16LE(buf, i),
            readI16LE(buf, i + 2),
            readASCIIString(buf, i + 4, 4),
            readASCIIString(buf, i + 4, 12),
            readASCIIString(buf, i + 4, 20),
            readU16LE(buf, i + 28)
        )
    }
}

type DoomVertex = [number, number]
const DoomVertexSize = 4

function parseDoomVertex(buf: Uint8Array, i: number): DoomVertex {
    return [readI16LE(buf, i), readI16LE(buf, i + 2)]
}

enum SegDirection {
    SAME = 0,
    OPPOSITE = 1
}

class DoomSegment {
    static readonly StructSize = 12

    readonly startVertexIndex: number
    readonly endVertexIndex: number
    readonly angle: number
    readonly lineDefIndex: number
    readonly direction: SegDirection
    readonly offset: number

    constructor(startVertexIndex: number, endVertexIndex: number, angle: number, lineDefIndex: number, direction: SegDirection, offset: number) {
        this.startVertexIndex = startVertexIndex;
        this.endVertexIndex = endVertexIndex;
        this.angle = angle;
        this.lineDefIndex = lineDefIndex;
        this.direction = direction;
        this.offset = offset;
    }

    static parse(buf: Uint8Array, i: number): DoomSegment {
        return new DoomSegment(
            readU16LE(buf, i),
            readU16LE(buf, i + 2),
            readU16LE(buf, i + 4),
            readU16LE(buf, i + 6),
            <SegDirection>readU16LE(buf, i + 8),
            readI16LE(buf, i + 18)
        )
    }
}

class DoomSubSector {
    static readonly StructSize = 4

    readonly segmentCount: number
    readonly firstSegmentIndex: number

    constructor(segmentCount: number, firstSegmentIndex: number) {
        this.segmentCount = segmentCount;
        this.firstSegmentIndex = firstSegmentIndex;
    }

    static parse(buf: Uint8Array, i: number): DoomSubSector {
        return new DoomSubSector(
            readU16LE(buf, i),
            readU16LE(buf, i + 2),
        )
    }
}

class DoomBoundingBox {
    static readonly StructSize = 8

    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;

    constructor(top: number, bottom: number, left: number, right: number) {
        this.top = top;
        this.bottom = bottom;
        this.left = left;
        this.right = right;
    }

    static parse(buf: Uint8Array, i: number): DoomBoundingBox {
        return new DoomBoundingBox(
            readI16LE(buf, i),
            readI16LE(buf, i + 2),
            readI16LE(buf, i + 4),
            readI16LE(buf, i + 6)
        )
    }
}

class DoomNode {
    static readonly StructSize = 28

    readonly partitionLineX: number
    readonly partitionLineY: number
    readonly partitionLineXSize: number
    readonly partitionLineYSize: number
    readonly rightBoundingBox: DoomBoundingBox
    readonly leftBoundingBox: DoomBoundingBox
    readonly rightChildIndex: number
    readonly leftChildIndex: number

    constructor(partitionLineX: number, partitionLineY: number, partitionLineXSize: number, partitionLineYSize: number, rightBoundingBox: DoomBoundingBox, leftBoundingBox: DoomBoundingBox, rightChildIndex: number, leftChildIndex: number) {
        this.partitionLineX = partitionLineX;
        this.partitionLineY = partitionLineY;
        this.partitionLineXSize = partitionLineXSize;
        this.partitionLineYSize = partitionLineYSize;
        this.rightBoundingBox = rightBoundingBox;
        this.leftBoundingBox = leftBoundingBox;
        this.rightChildIndex = rightChildIndex;
        this.leftChildIndex = leftChildIndex;
    }

    static parse(buf: Uint8Array, i: number): DoomNode {
        return new DoomNode(
            readI16LE(buf, i),
            readI16LE(buf, i + 2),
            readI16LE(buf, i + 4),
            readI16LE(buf, i + 6),
            DoomBoundingBox.parse(buf, i + 8),
            DoomBoundingBox.parse(buf, i + 16),
            readU16LE(buf, i + 24),
            readU16LE(buf, i + 26)
        )
    }
}

class DoomSector {
    static readonly StructSize = 26

    readonly floorHeight: number;
    readonly ceilingHeight: number;
    readonly floorTextureName: string;
    readonly ceilingTextureName: string;
    readonly lightLevel: number;
    readonly type: number;
    readonly tag: number;

    constructor(floorHeight: number, ceilingHeight: number, floorTextureName: string, ceilingTextureName: string, lightLevel: number, type: number, tag: number) {
        this.floorHeight = floorHeight;
        this.ceilingHeight = ceilingHeight;
        this.floorTextureName = floorTextureName;
        this.ceilingTextureName = ceilingTextureName;
        this.lightLevel = lightLevel;
        this.type = type;
        this.tag = tag;
    }

    static parse(buf: Uint8Array, i: number): DoomSector {
        return new DoomSector(
            readU16LE(buf, i),
            readU16LE(buf, i + 2),
            readASCIIString(buf, i + 4, 8),
            readASCIIString(buf, i + 12, 8),
            readI16LE(buf, i + 20),
            readI16LE(buf, i + 22),
            readI16LE(buf, i + 24)
        )
    }
}

class DoomBlockMap {
    readonly originX: number
    readonly originY: number
    readonly columnCount: number
    readonly rowCount: number

    readonly lineDefIndices: number[][]

    constructor(originX: number, originY: number, columnCount: number, rowCount: number, lineDefIndices: number[][]) {
        this.originX = originX;
        this.originY = originY;
        this.columnCount = columnCount;
        this.rowCount = rowCount;
        this.lineDefIndices = lineDefIndices;
    }

    static parse(buf: Uint8Array): DoomBlockMap {
        let originX = readI16LE(buf, 0)
        let originY = readI16LE(buf, 2)
        let columnCount = readU16LE(buf, 4)
        let rowCount = readU16LE(buf, 6)

        let blockCount = columnCount * rowCount
        let lineDefMap: number[][] = new Array<number[]>(blockCount)

        for (let i = 0; i < blockCount; ++i) {
            let offset = readU16LE(buf, 8 + (i * 2)) * 2

            let lineDefIndex = readU16LE(buf, offset)
            if (lineDefIndex !== 0) {
                throw `lineDef sequence did not start with zero!`
            }

            offset += 2;
            let indices: number[] = []

            while ((lineDefIndex = readU16LE(buf, offset)) !== 0xFFFF) {
                indices.push(lineDefIndex)
                offset += 2
            }

            lineDefMap.push(indices)
        }

        return new DoomBlockMap(originX, originY, columnCount, rowCount, lineDefMap)
    }
}

class DoomSound {
    readonly format: number
    readonly sampleRate: number
    readonly sampleCount: number
    readonly samples: Uint8Array

    constructor(format: number, sampleRate: number, sampleCount: number, samples: Uint8Array) {
        this.format = format;
        this.sampleRate = sampleRate;
        this.sampleCount = sampleCount;
        this.samples = samples;
    }

    static parse(buf: Uint8Array): DoomSound {
        let format = readU16LE(buf, 0);
        let sampleRate = readU16LE(buf, 2);
        let sampleCount = readU32LE(buf, 4)
        return new DoomSound(
            format,
            sampleRate,
            sampleCount,
            buf.slice(24, 24 + sampleCount)
        )
    }
}
