
class DoomGame {
    readonly maps: Map<MapName, DoomMap>
}
type MapName = {x: number, y: number}

class DoomMap {
    readonly name: MapName
    readonly things: DoomThing[]
    readonly lineDefs: DoomLineDef[]
    readonly sideDefs: any
    readonly vertexes: any
    readonly segments: any
    readonly subSectors: any
    readonly nodes: any
    readonly sectors: any
    readonly blockMap: any
    readonly behavior: any
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

    static parseAll(buf: Uint8Array): DoomThing[] {
        let things: DoomThing[] = []
        let size = buf.length
        for (let i = 0; i < size; i += DoomThing.StructSize) {
            things.push(DoomThing.parse(buf, i))
        }
        return things
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

    static parseAll(buf: Uint8Array): DoomLineDef[] {
        let things: DoomLineDef[] = []
        let size = buf.length
        for (let i = 0; i < size; i += DoomLineDef.StructSize) {
            things.push(DoomLineDef.parse(buf, i))
        }
        return things
    }
}

type DoomVertex = [number, number]

