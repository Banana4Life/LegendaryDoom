class DoomGame {
    readonly wad: WAD
    readonly colorMaps: DoomColorMap[]
    readonly colorPalettes: DoomPalette[]
    readonly patches: DoomPatchMap
    readonly flats: DoomFlatFolder
    readonly textures: DoomTextureMap
    readonly maps: DoomMap[]

    private readonly mapLookup: Map<DoomMapName, DoomMap>

    constructor(wad: WAD, colorMap: DoomColorMap[], colorPalette: DoomPalette[], patches: DoomPatchMap, flats: DoomFlatFolder, textures: DoomTextureMap, maps: DoomMap[]) {
        this.wad = wad
        this.colorMaps = colorMap
        this.colorPalettes = colorPalette
        this.patches = patches
        this.flats = flats
        this.textures = textures
        this.maps = maps
        this.mapLookup = new Map<DoomMapName, DoomMap>()
        for (let map of maps) {
            this.mapLookup.set(map.name, map)
        }
    }

    getMap(name: DoomMapName): DoomMap | undefined {
        return this.mapLookup.get(name)
    }

    getSound(name: string): DoomSound | null {
        return DoomGame.parseLumpAs(this.wad, `DS${name}`, DoomSound.parse)
    }

    getMusic(name: string): DoomMusic | null {
        return DoomGame.parseLumpAs(this.wad, name, DoomMusic.parse)
    }

    static findLumpIndex(dict: WADDictionary, name: string): number {
        let upper = name.toUpperCase()
        for (let i = dict.length - 1; i >= 0; --i) {
            let lump = dict[i]
            if (lump.name === upper) {
                return i;
            }
        }
        return -1
    }

    static findLump(dict: WADDictionary, name: string): WADLump | null {
        let index = DoomGame.findLumpIndex(dict, name)
        if (index === -1) {
            return null
        }
        return dict[index]
    }

    private static parseLumpAs<T>(wad: WAD, name: string, parser: (buf: Uint8Array) => T): T | null {
        let lump = DoomGame.findLump(wad.dictionary, name)
        if (lump === null) {
            return null
        }

        return parser(lump.data)
    }

    private static parsePatches(wad: WAD): DoomPatchMap {
        let pnamesLump = DoomGame.findLump(wad.dictionary, "PNAMES")
        if (pnamesLump === null) {
            return new DoomPatchMap([])
        }

        let patchCount = readU32LE(pnamesLump.data, 0)
        let patches = new Array<DoomPicture>(patchCount)
        for (let i = 0; i < patchCount; ++i) {
            let patchName = readASCIIString(pnamesLump.data, 4 + (i * WADLump.NameLength), WADLump.NameLength)
            let lump = DoomGame.findLump(wad.dictionary, patchName)
            patches[i] = DoomPicture.fromPatch(lump.name, lump.data)
        }

        return new DoomPatchMap(patches)
    }

    private static parseTextures(wad: WAD, patches: DoomPatchMap): DoomTextureMap {
        function parseTextureLump(lump: WADLump): DoomTexture[] {
            let buf = lump.data
            let textureCount = readU32LE(buf, 0)
            let textures: DoomTexture[] = []
            for (let i = 0; i < textureCount; ++i) {
                let textureOffset = readU32LE(buf, 4 + (4 * i))
                textures.push(DoomTexture.parse(buf, textureOffset, patches))
            }

            return textures
        }

        let textureLumpIndex = 1
        let allTextures: DoomTexture[] = []
        while (true) {
            let lump = DoomGame.findLump(wad.dictionary, `TEXTURE${textureLumpIndex}`)
            if (lump === null) {
                break;
            }
            let lumpTextures = parseTextureLump(lump);
            allTextures.push(...lumpTextures)
            textureLumpIndex++
        }

        let map = new Map<string, DoomTexture>()
        for (let tex of allTextures) {
            map.set(tex.name, tex)
        }

        return new DoomTextureMap(map)
    }

    private static parseMaps(wad: WAD, textures: DoomTextureMap): DoomMap[] {

        let originalName = /^(?:E(\d+)M(\d+))$/
        let laterName = /^MAP(\d+)$/

        function extractName(lump: WADLump): DoomMapName | null {
            let originalMatch = originalName.exec(lump.name)
            if (originalMatch !== null) {
                return {episode: parseInt(originalMatch[1]), map: parseInt(originalMatch[2])}
            }

            let laterMatch = laterName.exec(lump.name)
            if (laterMatch !== null) {
                return {level: parseInt(laterMatch[1])}
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
                maps.push(DoomMap.parse(wad, name, from, textures))
                return findMaps(from + 1, maps)
            }
        }


        return findMaps(0, [])

    }

    static parse(wad: WAD): DoomGame {
        let colorMap = DoomGame.parseLumpAs(wad, "COLORMAP", parsingAll(DoomColorMap.MapSize, DoomColorMap.parse))
        let colorPalette = DoomGame.parseLumpAs(wad, "PLAYPAL", parsingAll(DoomPalette.PaletteSize, DoomPalette.parse))
        let patches = DoomGame.parsePatches(wad)
        let flats = DoomFlatFolder.parse(wad.dictionary)
        let textures = DoomGame.parseTextures(wad, patches)
        let maps = DoomGame.parseMaps(wad, textures)

        return new DoomGame(wad, colorMap, colorPalette, patches, flats, textures, maps)
    }
}

type DoomMapName = { episode: number, map: number } | { level: number }

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
        this.name = name
        this.things = things
        this.lineDefs = lineDefs
        this.sideDefs = sideDefs
        this.vertexes = vertexes
        this.segments = segments
        this.subSectors = subSectors
        this.nodes = nodes
        this.sectors = sectors
        this.blockMap = blockMap
    }

    static parse(wad: WAD, name: DoomMapName, lumpOffset: number, textures: DoomTextureMap): DoomMap {
        let things = DoomMap.parseLump(wad, lumpOffset + 1, "THINGS", parsingAll(DoomThing.StructSize, DoomThing.parse))
        let lineDefs = DoomMap.parseLump(wad, lumpOffset + 2, "LINEDEFS", parsingAll(DoomLineDef.StructSize, DoomLineDef.parse))
        let sideDefs = DoomMap.parseLump(wad, lumpOffset + 3, "SIDEDEFS", parsingAll(DoomSideDef.StructSize, (buf, i) => DoomSideDef.parse(buf, i, textures)))
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
        let lump = wad.dictionary[i]
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
        this.x = x
        this.y = y
        this.angle = angle
        this.type = type
        this.flags = flags
    }

    static parse(buf: Uint8Array, i: number): DoomThing {
        return new DoomThing(
            readI16LE(buf, i),
            readI16LE(buf, i + 2),
            readI16LE(buf, i + 4),
            readI16LE(buf, i + 6),
            readI16LE(buf, i + 8)
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
        this.startVertexIndex = startVertexIndex
        this.endVertexIndex = endVertexIndex
        this.flags = flags
        this.specialType = specialType
        this.sectorTag = sectorTag
        this.rightSideDefIndex = rightSideDefIndex
        this.leftSideDefIndex = leftSideDefIndex
    }

    static parse(buf: Uint8Array, i: number): DoomLineDef {
        return new DoomLineDef(
            readI16LE(buf, i),
            readI16LE(buf, i + 2),
            readI16LE(buf, i + 4),
            readI16LE(buf, i + 6),
            readI16LE(buf, i + 8),
            readI16LE(buf, i + 10),
            readI16LE(buf, i + 12)
        )
    }
}

class DoomSideDef {
    static readonly StructSize = 30

    readonly offsetX: number
    readonly offsetY: number
    readonly upperTextureName: DoomTexture | null
    readonly lowerTextureName: DoomTexture | null
    readonly middleTextureName: DoomTexture | null
    readonly sectorIndex: number


    constructor(offsetX: number, offsetY: number, upperTextureName: DoomTexture | null, lowerTextureName: DoomTexture | null, middleTextureName: DoomTexture | null, sectorIndex: number) {
        this.offsetX = offsetX
        this.offsetY = offsetY
        this.upperTextureName = upperTextureName
        this.lowerTextureName = lowerTextureName
        this.middleTextureName = middleTextureName
        this.sectorIndex = sectorIndex
    }

    static parse(buf: Uint8Array, i: number, textures: DoomTextureMap): DoomSideDef {
        return new DoomSideDef(
            readI16LE(buf, i),
            readI16LE(buf, i + 2),
            textures.getTexture(readASCIIString(buf, i + 4, WADLump.NameLength)),
            textures.getTexture(readASCIIString(buf, i + 12, WADLump.NameLength)),
            textures.getTexture(readASCIIString(buf, i + 20, WADLump.NameLength)),
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
        this.startVertexIndex = startVertexIndex
        this.endVertexIndex = endVertexIndex
        this.angle = angle
        this.lineDefIndex = lineDefIndex
        this.direction = direction
        this.offset = offset
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
        this.segmentCount = segmentCount
        this.firstSegmentIndex = firstSegmentIndex
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

    readonly top: number
    readonly bottom: number
    readonly left: number
    readonly right: number

    constructor(top: number, bottom: number, left: number, right: number) {
        this.top = top
        this.bottom = bottom
        this.left = left
        this.right = right
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
        this.partitionLineX = partitionLineX
        this.partitionLineY = partitionLineY
        this.partitionLineXSize = partitionLineXSize
        this.partitionLineYSize = partitionLineYSize
        this.rightBoundingBox = rightBoundingBox
        this.leftBoundingBox = leftBoundingBox
        this.rightChildIndex = rightChildIndex
        this.leftChildIndex = leftChildIndex
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

    readonly floorHeight: number
    readonly ceilingHeight: number
    readonly floorTextureName: string
    readonly ceilingTextureName: string
    readonly lightLevel: number
    readonly type: number
    readonly tag: number

    constructor(floorHeight: number, ceilingHeight: number, floorTextureName: string, ceilingTextureName: string, lightLevel: number, type: number, tag: number) {
        this.floorHeight = floorHeight
        this.ceilingHeight = ceilingHeight
        this.floorTextureName = floorTextureName
        this.ceilingTextureName = ceilingTextureName
        this.lightLevel = lightLevel
        this.type = type
        this.tag = tag
    }

    static parse(buf: Uint8Array, i: number): DoomSector {
        return new DoomSector(
            readI16LE(buf, i),
            readI16LE(buf, i + 2),
            readASCIIString(buf, i + 4, WADLump.NameLength),
            readASCIIString(buf, i + 12, WADLump.NameLength),
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
        this.originX = originX
        this.originY = originY
        this.columnCount = columnCount
        this.rowCount = rowCount
        this.lineDefIndices = lineDefIndices
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

            offset += 2
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
        this.format = format
        this.sampleRate = sampleRate
        this.sampleCount = sampleCount
        this.samples = samples
    }

    static parse(buf: Uint8Array): DoomSound {
        let format = readU16LE(buf, 0)
        let sampleRate = readU16LE(buf, 2)
        let sampleCount = readU32LE(buf, 4)
        return new DoomSound(
            format,
            sampleRate,
            sampleCount,
            buf.slice(24, 24 + sampleCount)
        )
    }
}

type DoomMusicFormat = "mus" | "midi"

class DoomMusic {
    readonly format: DoomMusicFormat
    readonly data: Uint8Array

    constructor(format: DoomMusicFormat, data: Uint8Array) {
        this.format = format;
        this.data = data;
    }

    static parse(buf: Uint8Array): DoomMusic {
        return new DoomMusic(
            "mus", buf
        )
    }
}

class DoomColorMap {
    static readonly MapSize = 256

    readonly map: number[]

    constructor(map: number[]) {
        this.map = map;
    }

    static parse(buf: Uint8Array, offset: number): DoomColorMap {
        let map: number[] = new Array<number>(DoomColorMap.MapSize)
        for (let i = 0; i < DoomColorMap.MapSize; ++i) {
            map[i] = buf[offset + i]
        }

        return new DoomColorMap(map)
    }
}

class DoomPalette {
    static readonly Colors = 256
    static readonly Channels = 3
    static readonly PaletteSize = DoomPalette.Colors * DoomPalette.Channels

    readonly colors: [number, number, number][]

    constructor(colors: [number, number, number][]) {
        this.colors = colors;
    }

    static parse(buf: Uint8Array, offset: number): DoomPalette {
        let palette: [number, number, number][] = new Array<[number, number, number]>(DoomPalette.Colors)
        for (let i = 0; i < DoomPalette.Colors; ++i) {
            palette[i] = [buf[offset + i], buf[offset + i + 1], buf[offset + i + 2]]
        }

        return new DoomPalette(palette)
    }
}

class DoomPatchMap {
    private readonly patches: DoomPicture[]
    private readonly byNameLookup: Map<string, DoomPicture>

    constructor(patches: DoomPicture[]) {
        this.patches = patches
        this.byNameLookup = new Map<string, DoomPicture>()
        for (let patch of patches) {
            this.byNameLookup.set(patch.name, patch)
        }
    }

    getPatch(id: number | string): DoomPicture | undefined {
        if (typeof id === 'string') {
            return this.byNameLookup.get(id.toUpperCase())
        } else {
            return this.patches[id]
        }
    }
}

type DoomPixelData = ArrayLike<number>
class DoomPicture {
    static readonly FlatSize = 64
    static readonly TransparencyValue = -1

    readonly name: string
    readonly width: number
    readonly height: number
    readonly offsetX: number
    readonly offsetY: number
    readonly pixels: DoomPixelData

    constructor(name: string, width: number, height: number, offsetX: number, offsetY: number, pixels: DoomPixelData) {
        this.name = name
        this.width = width
        this.height = height
        this.offsetX = offsetX
        this.offsetY = offsetY
        this.pixels = pixels
    }

    // For format description, check CHAPTER [5-1] in dmspec16.txt
    static fromPatch(name: string, buf: Uint8Array): DoomPicture {
        let width = readU16LE(buf, 0)
        let height = readU16LE(buf, 2)
        let offsetX = readU16LE(buf, 4)
        let offsetY = readU16LE(buf, 6)

        let pixelData = new Array(width * height)
        pixelData.fill(DoomPicture.TransparencyValue, 0, pixelData.length)

        let columnPointers = [];
        for (let x = 0; x < width; ++x) {
            columnPointers[x] = readU32LE(buf, 8 + (x * 4));
        }

        for (let x = 0; x < width; ++x) {

            let columnOffset = columnPointers[x]

            while (true) {
                let heightOffset = buf[columnOffset++]
                if (heightOffset === 0xFF) {
                    break
                }
                let pixelCount = buf[columnOffset++]

                columnOffset++ // unused byte

                for (let y = 0; y < pixelCount; ++y) {
                    pixelData[((heightOffset + y) * width) + x] = buf[columnOffset++]
                }

                columnOffset++ // unused byte
            }
        }

        return new DoomPicture(name, width, height, offsetX, offsetY, pixelData)
    }

    static fromFlat(name: string, buf: Uint8Array): DoomPicture {
        return new DoomPicture(name, DoomPicture.FlatSize, DoomPicture.FlatSize, 0, 0, buf)
    }
}

type DoomFlatTree = DoomFlatFolder | DoomPicture
class DoomFlatFolder {
    static readonly RootName = "F"
    static readonly RootLumpName = `${DoomFlatFolder.RootName}_START`

    static readonly FlatFolderStartPattern = /(F\d*)_START/
    static readonly FlatFolderEndPattern = /(F\d*)_END/

    readonly name: string
    readonly children: DoomFlatTree[]

    private readonly childLookup: Map<string, DoomFlatTree>
    private readonly pictureLookup: Map<string, DoomPicture>
    private readonly pictureCount: number
    private readonly subFolders: DoomFlatFolder[]

    constructor(name: string, children: DoomFlatTree[]) {
        this.name = name
        this.children = children
        this.childLookup = new Map<string, DoomFlatTree>()
        this.pictureLookup = new Map<string, DoomPicture>()
        this.subFolders = []
        this.pictureCount = 0
        for (let child of children) {
            this.childLookup.set(child.name, child)
            if (child instanceof DoomPicture) {
                this.pictureLookup.set(child.name, child)
                this.pictureCount++
            } else {
                this.subFolders.push(child)
            }
        }
    }

    getSize(recurse: boolean = false): number {
        if (recurse) {
            return this.children.map(child => {
                if (child instanceof DoomFlatFolder) {
                    return child.getSize(recurse)
                } else {
                    return 1
                }
            }).reduce((a, b) => a + b)
        }
        return this.children.length
    }

    getPictureCount(recurse: boolean = false): number {
        if (recurse) {
            return this.children.map(child => {
                if (child instanceof DoomFlatFolder) {
                    return child.getPictureCount(recurse)
                } else {
                    return 1
                }
            }).reduce((a, b) => a + b)
        }
        return this.pictureCount
    }

    getChild(name: string): DoomFlatTree | undefined {
        return this.childLookup.get(name)
    }

    getPicture(name: string, recurse: boolean = false): DoomPicture | undefined {
        let picture = this.pictureLookup.get(name)
        if (picture === undefined && recurse) {
            for (let folder of this.subFolders) {
                picture = folder.getPicture(name, recurse)
                if (picture !== undefined) {
                    return picture
                }
            }
        }
        return picture
    }

    static parse(dict: WADDictionary): DoomFlatFolder {

        function parseTree(dict: WADDictionary, name: string, lumpIndex: number): [number, DoomFlatFolder] {
            let children: DoomFlatTree[] = []
            while (lumpIndex < dict.length) {
                let lump = dict[lumpIndex]
                let lumpName = lump.name

                let folderStartMatch = DoomFlatFolder.FlatFolderStartPattern.exec(lumpName)
                let folderEndMatch = DoomFlatFolder.FlatFolderEndPattern.exec(lumpName)
                if (folderStartMatch !== null) {
                    let [, folderStartName] = folderStartMatch
                    let [newLumpIndex, folder] = parseTree(dict, folderStartName, lumpIndex + 1)
                    children.push(folder)
                    lumpIndex = newLumpIndex
                } else if (folderEndMatch !== null) {
                    let [, folderEndName] = folderEndMatch
                    if (name != folderEndName) {
                        throw `Folder end (${folderEndName}) mismatched folder start (${name})!`
                    }
                    return [lumpIndex + 1, new DoomFlatFolder(name, children)]
                } else {
                    children.push(DoomPicture.fromFlat(lumpName, dict[lumpIndex].data))
                    lumpIndex++
                }
            }
            return [lumpIndex, new DoomFlatFolder(name, children)]
        }

        let lumpIndex = DoomGame.findLumpIndex(dict, DoomFlatFolder.RootLumpName)

        let [, folder] = parseTree(dict, DoomFlatFolder.RootName, lumpIndex + 1)
        return folder
    }
}

class DoomTextureMap {
    readonly textures: Map<string, DoomTexture>

    constructor(textures: Map<string, DoomTexture>) {
        this.textures = textures;
    }

    getTexture(name: string): DoomTexture | null {
        let tex = this.textures.get(name)
        if (tex === undefined) {
            return null
        }
        return tex
    }
}

class DoomTexture {
    readonly name: string
    readonly masked: boolean
    readonly width: number
    readonly height: number
    readonly patches: DoomTexturePatch[]

    constructor(name: string, masked: boolean, width: number, height: number, patches: DoomTexturePatch[]) {
        this.name = name;
        this.masked = masked;
        this.width = width;
        this.height = height;
        this.patches = patches;
    }

    static parse(buf: Uint8Array, offset: number, patches: DoomPatchMap): DoomTexture {
        let name = readASCIIString(buf, offset, WADLump.NameLength)
        let masked = readU32LE(buf, offset + WADLump.NameLength) !== 0
        let width = readU16LE(buf, offset + 12)
        let height = readU16LE(buf, offset + 14)
        // 4 bytes for "columndirectory", seems to be unused
        let patchCount = readU16LE(buf, offset + 20)
        let texturePatches: DoomTexturePatch[] = new Array<DoomTexturePatch>(patchCount)
        for (let i = 0; i < patchCount; ++i) {
            texturePatches[i] = DoomTexturePatch.parse(buf, offset + 22 + (DoomTexturePatch.StructSize * i), patches)
        }

        return new DoomTexture(name, masked, width, height, texturePatches)
    }
}

class DoomTexturePatch {
    static readonly StructSize = 10

    readonly originX: number
    readonly originY: number
    readonly patch: DoomPicture

    constructor(originX: number, originY: number, patch: DoomPicture) {
        this.originX = originX;
        this.originY = originY;
        this.patch = patch;
    }

    static parse(buf: Uint8Array, offset: number, patches: DoomPatchMap): DoomTexturePatch {
        let offsetX = readI16LE(buf, offset)
        let offsetY = readI16LE(buf, offset + 2)
        let patchIndex = readU16LE(buf, offset + 4)
        // 2 more fields, which are not used/known: stepdir, colormap
        return new DoomTexturePatch(offsetX, offsetY, patches.getPatch(patchIndex))
    }
}
