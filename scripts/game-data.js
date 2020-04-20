var DoomGame = /** @class */ (function () {
    function DoomGame(wad, colorMap, colorPalette, patches, flats, textures, maps) {
        this.mobj = mobjobinfos();
        this.wad = wad;
        this.colorMaps = colorMap;
        this.colorPalettes = colorPalette;
        this.patches = patches;
        this.flats = flats;
        this.textures = textures;
        this.maps = maps;
        this.mapLookup = new Map();
        for (var _i = 0, maps_1 = maps; _i < maps_1.length; _i++) {
            var map = maps_1[_i];
            this.mapLookup.set(map.name, map);
        }
    }
    DoomGame.prototype.getMap = function (name) {
        return this.mapLookup.get(name);
    };
    DoomGame.prototype.getSound = function (name) {
        return DoomGame.parseLumpAs(this.wad, "DS" + name, DoomSound.parse);
    };
    DoomGame.prototype.getMusic = function (name) {
        return DoomGame.parseLumpAs(this.wad, name, DoomMusic.parse);
    };
    DoomGame.prototype.getSpriteSet = function (prefix) {
        return DoomSpriteSet.parse(this.wad.dictionary, prefix);
    };
    DoomGame.prototype.getArbitraryPicture = function (name) {
        var lump = DoomGame.findLump(this.wad.dictionary, name);
        if (lump === null) {
            return null;
        }
        return DoomPicture.fromPatch(lump.name, lump.data);
    };
    DoomGame.findLumpIndex = function (dict, name) {
        var upper = name.toUpperCase();
        for (var i = dict.length - 1; i >= 0; --i) {
            var lump = dict[i];
            if (lump.name === upper) {
                return i;
            }
        }
        return -1;
    };
    DoomGame.findLump = function (dict, name) {
        var index = DoomGame.findLumpIndex(dict, name);
        if (index === -1) {
            return null;
        }
        return dict[index];
    };
    DoomGame.parseLumpAs = function (wad, name, parser) {
        var lump = DoomGame.findLump(wad.dictionary, name);
        if (lump === null) {
            return null;
        }
        return parser(lump.data);
    };
    DoomGame.parsePatches = function (wad) {
        var pnamesLump = DoomGame.findLump(wad.dictionary, "PNAMES");
        if (pnamesLump === null) {
            return new DoomPatchMap([]);
        }
        var patchCount = readU32LE(pnamesLump.data, 0);
        var patches = new Array(patchCount);
        for (var i = 0; i < patchCount; ++i) {
            var patchName = readASCIIString(pnamesLump.data, 4 + (i * WADLump.NameLength), WADLump.NameLength);
            var lump = DoomGame.findLump(wad.dictionary, patchName);
            patches[i] = DoomPicture.fromPatch(lump.name, lump.data);
        }
        return new DoomPatchMap(patches);
    };
    DoomGame.parseTextures = function (wad, patches) {
        function parseTextureLump(lump) {
            var buf = lump.data;
            var textureCount = readU32LE(buf, 0);
            var textures = [];
            for (var i = 0; i < textureCount; ++i) {
                var textureOffset = readU32LE(buf, 4 + (4 * i));
                textures.push(DoomTexture.parse(buf, textureOffset, patches));
            }
            return textures;
        }
        var textureLumpIndex = 1;
        var allTextures = [];
        while (true) {
            var lump = DoomGame.findLump(wad.dictionary, "TEXTURE" + textureLumpIndex);
            if (lump === null) {
                break;
            }
            var lumpTextures = parseTextureLump(lump);
            allTextures.push.apply(allTextures, lumpTextures);
            textureLumpIndex++;
        }
        var map = new Map();
        for (var _i = 0, allTextures_1 = allTextures; _i < allTextures_1.length; _i++) {
            var tex = allTextures_1[_i];
            map.set(tex.name, tex);
        }
        return new DoomTextureMap(map);
    };
    DoomGame.parseMaps = function (wad, textures) {
        var originalName = /^(?:E(\d+)M(\d+))$/;
        var laterName = /^MAP(\d+)$/;
        function extractName(lump) {
            var originalMatch = originalName.exec(lump.name);
            if (originalMatch !== null) {
                return { episode: parseInt(originalMatch[1]), map: parseInt(originalMatch[2]) };
            }
            var laterMatch = laterName.exec(lump.name);
            if (laterMatch !== null) {
                return { level: parseInt(laterMatch[1]) };
            }
            return null;
        }
        function findMaps(from, maps) {
            if (from >= wad.dictionary.length) {
                return maps;
            }
            var lump = wad.dictionary[from];
            var name = extractName(lump);
            if (name === null) {
                return findMaps(from + 1, maps);
            }
            else {
                maps.push(DoomMap.parse(wad, name, from, textures));
                return findMaps(from + 1, maps);
            }
        }
        return findMaps(0, []);
    };
    DoomGame.parse = function (wad) {
        var colorMap = DoomGame.parseLumpAs(wad, "COLORMAP", parsingAll(DoomColorMap.MapSize, DoomColorMap.parse));
        var colorPalette = DoomGame.parseLumpAs(wad, "PLAYPAL", parsingAll(DoomPalette.PaletteSize, DoomPalette.parse));
        var patches = DoomGame.parsePatches(wad);
        var flats = DoomFlatFolder.parse(wad.dictionary);
        var textures = DoomGame.parseTextures(wad, patches);
        var maps = DoomGame.parseMaps(wad, textures);
        colorPalette.forEach(function (p) { return p.dumpToUrl(); });
        return new DoomGame(wad, colorMap, colorPalette, patches, flats, textures, maps);
    };
    DoomGame.prototype.logStats = function () {
        console.info("WAD type: " + this.wad.header.type);
        console.info("Lump count: " + this.wad.dictionary.length);
        console.info("Number of color maps loaded: " + this.colorMaps.length);
        console.info("Number of color palettes loaded: " + this.colorPalettes.length);
        console.info("Number of patches loaded: " + this.patches.getSize());
        console.info("Number of flats loaded: " + this.flats.getSize(true) + " (" + this.flats.getPictureCount(true) + " pictures)");
        console.info("Number of textures loaded: " + this.textures.getSize());
        console.info("Number of maps loaded: " + this.maps.length);
    };
    return DoomGame;
}());
var DoomMap = /** @class */ (function () {
    function DoomMap(name, things, lineDefs, sideDefs, vertexes, segments, subSectors, nodes, sectors, blockMap) {
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
    DoomMap.parse = function (wad, name, lumpOffset, textures) {
        var things = DoomMap.parseLump(wad, lumpOffset + 1, "THINGS", parsingAll(DoomThing.StructSize, DoomThing.parse));
        var lineDefs = DoomMap.parseLump(wad, lumpOffset + 2, "LINEDEFS", parsingAll(DoomLineDef.StructSize, DoomLineDef.parse));
        var sideDefs = DoomMap.parseLump(wad, lumpOffset + 3, "SIDEDEFS", parsingAll(DoomSideDef.StructSize, function (buf, i) { return DoomSideDef.parse(buf, i, textures); }));
        var vertexes = DoomMap.parseLump(wad, lumpOffset + 4, "VERTEXES", parsingAll(DoomVertexSize, parseDoomVertex));
        var segments = DoomMap.parseLump(wad, lumpOffset + 5, "SEGS", parsingAll(DoomSegment.StructSize, DoomSegment.parse));
        var subSectors = DoomMap.parseLump(wad, lumpOffset + 6, "SSECTORS", parsingAll(DoomSubSector.StructSize, DoomSubSector.parse));
        var nodes = DoomMap.parseLump(wad, lumpOffset + 7, "NODES", parsingAll(DoomNode.StructSize, DoomNode.parse));
        var sectors = DoomMap.parseLump(wad, lumpOffset + 8, "SECTORS", parsingAll(DoomSector.StructSize, DoomSector.parse));
        // FIXME:
        // REJECT table at lumpOffset + 9
        var blockMap = DoomMap.parseLump(wad, lumpOffset + 10, "BLOCKMAP", DoomBlockMap.parse);
        return new DoomMap(name, things, lineDefs, sideDefs, vertexes, segments, subSectors, nodes, sectors, blockMap);
    };
    DoomMap.parseLump = function (wad, i, expectedLumpName, parser) {
        var lump = wad.dictionary[i];
        if (lump.name !== expectedLumpName) {
            throw "Unexpected lump: expected " + expectedLumpName + ", but was " + lump.name;
        }
        return parser(lump.data);
    };
    DoomMap.prototype.getSectorAt = function (x, y) {
        function pointOnSide(x, y, node) {
            var dx;
            var dy;
            var left;
            var right;
            if (!node.partitionLineXSize) {
                if (x <= node.partitionLineX)
                    return node.partitionLineYSize > 0 ? 1 : 0;
                return node.partitionLineYSize < 0 ? 1 : 0;
            }
            if (!node.partitionLineYSize) {
                if (y <= node.partitionLineY)
                    return node.partitionLineXSize < 0 ? 1 : 0;
                return node.partitionLineXSize > 0 ? 1 : 0;
            }
            dx = (x - node.partitionLineX);
            dy = (y - node.partitionLineY);
            // Try to quickly decide by looking at sign bits.
            if ((node.partitionLineYSize ^ node.partitionLineXSize ^ dx ^ dy) & 0x80000000) {
                if ((node.partitionLineYSize ^ dx) & 0x80000000) {
                    // (left is negative)
                    return 1;
                }
                return 0;
            }
            function FixedMul(a, b) {
                return (a * b) >> 16;
            }
            left = FixedMul(node.partitionLineYSize >> 16, dx);
            right = FixedMul(dy, node.partitionLineXSize >> 16);
            if (right < left) {
                // front side
                return 0;
            }
            // back side
            return 1;
        }
        var NF_SUBSECTOR = 0x8000;
        var nodenum = this.nodes.length - 1;
        while (!(nodenum & NF_SUBSECTOR)) {
            var node = this.nodes[nodenum];
            var side = pointOnSide(x, y, node);
            nodenum = side === 1 ? node.leftChildIndex : node.rightChildIndex;
        }
        var subSector = this.subSectors[nodenum & ~NF_SUBSECTOR];
        return subSector.getSector(this);
    };
    return DoomMap;
}());
function parseAll(buf, structSize, parse) {
    var all = [];
    var size = buf.length;
    for (var i = 0; i < size; i += structSize) {
        all.push(parse(buf, i));
    }
    return all;
}
function parsingAll(structSize, parse) {
    return function (buf) {
        return parseAll(buf, structSize, parse);
    };
}
var DoomThing = /** @class */ (function () {
    function DoomThing(x, y, angle, type, flags) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.type = type;
        this.flags = flags;
    }
    DoomThing.parse = function (buf, i) {
        return new DoomThing(readI16LE(buf, i), readI16LE(buf, i + 2), readI16LE(buf, i + 4), readI16LE(buf, i + 6), readI16LE(buf, i + 8));
    };
    DoomThing.StructSize = 10;
    return DoomThing;
}());
var DoomLineDef = /** @class */ (function () {
    function DoomLineDef(startVertexIndex, endVertexIndex, flags, specialType, sectorTag, rightSideDefIndex, leftSideDefIndex) {
        this.startVertexIndex = startVertexIndex;
        this.endVertexIndex = endVertexIndex;
        this.flags = flags;
        this.specialType = specialType;
        this.sectorTag = sectorTag;
        this.rightSideDefIndex = rightSideDefIndex;
        this.leftSideDefIndex = leftSideDefIndex;
    }
    DoomLineDef.parse = function (buf, i) {
        return new DoomLineDef(readI16LE(buf, i), readI16LE(buf, i + 2), readI16LE(buf, i + 4), readI16LE(buf, i + 6), readI16LE(buf, i + 8), readI16LE(buf, i + 10), readI16LE(buf, i + 12));
    };
    DoomLineDef.StructSize = 14;
    return DoomLineDef;
}());
var DoomSideDef = /** @class */ (function () {
    function DoomSideDef(offsetX, offsetY, upperTexture, lowerTexture, middleTexture, sectorIndex) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.upperTexture = upperTexture;
        this.lowerTexture = lowerTexture;
        this.middleTexture = middleTexture;
        this.sectorIndex = sectorIndex;
    }
    DoomSideDef.parse = function (buf, i, textures) {
        return new DoomSideDef(readI16LE(buf, i), readI16LE(buf, i + 2), textures.getTexture(readASCIIString(buf, i + 4, WADLump.NameLength)), textures.getTexture(readASCIIString(buf, i + 12, WADLump.NameLength)), textures.getTexture(readASCIIString(buf, i + 20, WADLump.NameLength)), readU16LE(buf, i + 28));
    };
    DoomSideDef.StructSize = 30;
    return DoomSideDef;
}());
var DoomVertexSize = 4;
function parseDoomVertex(buf, i) {
    return [readI16LE(buf, i), readI16LE(buf, i + 2)];
}
var SegDirection;
(function (SegDirection) {
    SegDirection[SegDirection["SAME"] = 0] = "SAME";
    SegDirection[SegDirection["OPPOSITE"] = 1] = "OPPOSITE";
})(SegDirection || (SegDirection = {}));
var DoomSegment = /** @class */ (function () {
    function DoomSegment(startVertexIndex, endVertexIndex, angle, lineDefIndex, direction, offset) {
        this.startVertexIndex = startVertexIndex;
        this.endVertexIndex = endVertexIndex;
        this.angle = angle;
        this.lineDefIndex = lineDefIndex;
        this.direction = direction;
        this.offset = offset;
    }
    DoomSegment.parse = function (buf, i) {
        return new DoomSegment(readU16LE(buf, i), readU16LE(buf, i + 2), readU16LE(buf, i + 4), readU16LE(buf, i + 6), readU16LE(buf, i + 8), readI16LE(buf, i + 18));
    };
    DoomSegment.StructSize = 12;
    return DoomSegment;
}());
var DoomSubSector = /** @class */ (function () {
    function DoomSubSector(segmentCount, firstSegmentIndex) {
        this.segmentCount = segmentCount;
        this.firstSegmentIndex = firstSegmentIndex;
    }
    DoomSubSector.parse = function (buf, i) {
        return new DoomSubSector(readU16LE(buf, i), readU16LE(buf, i + 2));
    };
    DoomSubSector.prototype.getSector = function (map) {
        if (!this.sector) {
            var segment = map.segments[this.firstSegmentIndex];
            var lineDef = map.lineDefs[segment.lineDefIndex];
            var sideDef = map.sideDefs[segment.direction === 0 ? lineDef.rightSideDefIndex : lineDef.leftSideDefIndex];
            this.sector = map.sectors[sideDef.sectorIndex];
        }
        return this.sector;
    };
    DoomSubSector.StructSize = 4;
    return DoomSubSector;
}());
var DoomBoundingBox = /** @class */ (function () {
    function DoomBoundingBox(top, bottom, left, right) {
        this.top = top;
        this.bottom = bottom;
        this.left = left;
        this.right = right;
    }
    DoomBoundingBox.parse = function (buf, i) {
        return new DoomBoundingBox(readI16LE(buf, i), readI16LE(buf, i + 2), readI16LE(buf, i + 4), readI16LE(buf, i + 6));
    };
    DoomBoundingBox.StructSize = 8;
    return DoomBoundingBox;
}());
var DoomNode = /** @class */ (function () {
    function DoomNode(partitionLineX, partitionLineY, partitionLineXSize, partitionLineYSize, rightBoundingBox, leftBoundingBox, rightChildIndex, leftChildIndex) {
        this.partitionLineX = partitionLineX;
        this.partitionLineY = partitionLineY;
        this.partitionLineXSize = partitionLineXSize;
        this.partitionLineYSize = partitionLineYSize;
        this.rightBoundingBox = rightBoundingBox;
        this.leftBoundingBox = leftBoundingBox;
        this.rightChildIndex = rightChildIndex;
        this.leftChildIndex = leftChildIndex;
    }
    DoomNode.parse = function (buf, i) {
        return new DoomNode(readI16LE(buf, i), readI16LE(buf, i + 2), readI16LE(buf, i + 4), readI16LE(buf, i + 6), DoomBoundingBox.parse(buf, i + 8), DoomBoundingBox.parse(buf, i + 16), readU16LE(buf, i + 24), readU16LE(buf, i + 26));
    };
    DoomNode.StructSize = 28;
    return DoomNode;
}());
var DoomSector = /** @class */ (function () {
    function DoomSector(floorHeight, ceilingHeight, floorTextureName, ceilingTextureName, lightLevel, type, tag) {
        this.floorHeight = floorHeight;
        this.ceilingHeight = ceilingHeight;
        this.floorTextureName = floorTextureName;
        this.ceilingTextureName = ceilingTextureName;
        this.lightLevel = lightLevel;
        this.type = type;
        this.tag = tag;
    }
    DoomSector.parse = function (buf, i) {
        return new DoomSector(readI16LE(buf, i), readI16LE(buf, i + 2), readASCIIString(buf, i + 4, WADLump.NameLength), readASCIIString(buf, i + 12, WADLump.NameLength), readI16LE(buf, i + 20), readI16LE(buf, i + 22), readI16LE(buf, i + 24));
    };
    DoomSector.StructSize = 26;
    return DoomSector;
}());
var DoomBlockMap = /** @class */ (function () {
    function DoomBlockMap(originX, originY, columnCount, rowCount, lineDefIndices) {
        this.originX = originX;
        this.originY = originY;
        this.columnCount = columnCount;
        this.rowCount = rowCount;
        this.lineDefIndices = lineDefIndices;
    }
    DoomBlockMap.parse = function (buf) {
        var originX = readI16LE(buf, 0);
        var originY = readI16LE(buf, 2);
        var columnCount = readU16LE(buf, 4);
        var rowCount = readU16LE(buf, 6);
        var blockCount = columnCount * rowCount;
        var lineDefMap = new Array(blockCount);
        for (var i = 0; i < blockCount; ++i) {
            var offset = readU16LE(buf, 8 + (i * 2)) * 2;
            var lineDefIndex = readU16LE(buf, offset);
            if (lineDefIndex !== 0) {
                throw "lineDef sequence did not start with zero!";
            }
            offset += 2;
            var indices = [];
            while ((lineDefIndex = readU16LE(buf, offset)) !== 0xFFFF) {
                indices.push(lineDefIndex);
                offset += 2;
            }
            lineDefMap.push(indices);
        }
        return new DoomBlockMap(originX, originY, columnCount, rowCount, lineDefMap);
    };
    return DoomBlockMap;
}());
var DoomSound = /** @class */ (function () {
    function DoomSound(format, sampleRate, sampleCount, samples) {
        this.format = format;
        this.sampleRate = sampleRate;
        this.sampleCount = sampleCount;
        this.samples = samples;
    }
    DoomSound.parse = function (buf) {
        var format = readU16LE(buf, 0);
        var sampleRate = readU16LE(buf, 2);
        var sampleCount = readU32LE(buf, 4);
        return new DoomSound(format, sampleRate, sampleCount, buf.slice(24, 24 + sampleCount));
    };
    return DoomSound;
}());
var DoomMusic = /** @class */ (function () {
    function DoomMusic(format, data) {
        this.format = format;
        this.data = data;
    }
    DoomMusic.parse = function (buf) {
        return new DoomMusic("mus", buf);
    };
    return DoomMusic;
}());
var DoomColorMap = /** @class */ (function () {
    function DoomColorMap(map) {
        this.map = map;
    }
    DoomColorMap.parse = function (buf, offset) {
        return new DoomColorMap(buf.slice(offset, offset + DoomColorMap.MapSize));
    };
    DoomColorMap.MapSize = 256;
    return DoomColorMap;
}());
var DoomPalette = /** @class */ (function () {
    function DoomPalette(colors) {
        this.colors = colors;
    }
    DoomPalette.parse = function (buf, offset) {
        var palette = new Array(DoomPalette.Colors);
        for (var i = 0; i < DoomPalette.Colors; ++i) {
            var colorOffset = offset + i * DoomPalette.Channels;
            palette[i] = [buf[colorOffset], buf[colorOffset + 1], buf[colorOffset + 2]];
        }
        return new DoomPalette(palette);
    };
    DoomPalette.prototype.dumpToUrl = function () {
        var canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        var ctx = canvas.getContext("2d");
        var imageData = ctx.createImageData(16, 16);
        for (var i = 0; i < DoomPalette.Colors; ++i) {
            var imageOffset = i * 4;
            imageData.data[imageOffset + 0] = this.colors[i][0];
            imageData.data[imageOffset + 1] = this.colors[i][1];
            imageData.data[imageOffset + 2] = this.colors[i][2];
            imageData.data[imageOffset + 3] = 255;
        }
        ctx.imageSmoothingEnabled = false;
        ctx.putImageData(imageData, 0, 0);
        console.log("color palette", canvas.toDataURL());
    };
    DoomPalette.Colors = 256;
    DoomPalette.Channels = 3;
    DoomPalette.PaletteSize = DoomPalette.Colors * DoomPalette.Channels;
    return DoomPalette;
}());
var DoomPatchMap = /** @class */ (function () {
    function DoomPatchMap(patches) {
        this.patches = patches;
        this.byNameLookup = new Map();
        for (var _i = 0, patches_1 = patches; _i < patches_1.length; _i++) {
            var patch = patches_1[_i];
            this.byNameLookup.set(patch.name, patch);
        }
    }
    DoomPatchMap.prototype.getPatch = function (id) {
        if (typeof id === 'string') {
            return this.byNameLookup.get(id.toUpperCase());
        }
        else {
            return this.patches[id];
        }
    };
    DoomPatchMap.prototype.getSize = function () {
        return this.patches.length;
    };
    return DoomPatchMap;
}());
var DoomPicture = /** @class */ (function () {
    function DoomPicture(name, width, height, offsetX, offsetY, pixels) {
        this.name = name;
        this.width = width;
        this.height = height;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.pixels = pixels;
    }
    // For format description, check CHAPTER [5-1] in dmspec16.txt
    DoomPicture.fromPatch = function (name, buf) {
        var width = readU16LE(buf, 0);
        var height = readU16LE(buf, 2);
        var offsetX = readU16LE(buf, 4);
        var offsetY = readU16LE(buf, 6);
        var pixelData = new Array(width * height);
        pixelData.fill(DoomPicture.TransparencyValue, 0, pixelData.length);
        var columnPointers = [];
        for (var x = 0; x < width; ++x) {
            columnPointers[x] = readU32LE(buf, 8 + (x * 4));
        }
        for (var x = 0; x < width; ++x) {
            var columnOffset = columnPointers[x];
            while (true) {
                var heightOffset = buf[columnOffset++];
                if (heightOffset === 0xFF) {
                    break;
                }
                var pixelCount = buf[columnOffset++];
                columnOffset++; // unused byte
                for (var y = 0; y < pixelCount; ++y) {
                    pixelData[((heightOffset + y) * width) + x] = buf[columnOffset++];
                }
                columnOffset++; // unused byte
            }
        }
        return new DoomPicture(name, width, height, offsetX, offsetY, pixelData);
    };
    DoomPicture.fromFlat = function (name, buf) {
        return new DoomPicture(name, DoomPicture.FlatSize, DoomPicture.FlatSize, 0, 0, buf);
    };
    DoomPicture.FlatSize = 64;
    DoomPicture.TransparencyValue = -1;
    return DoomPicture;
}());
var DoomFlatFolder = /** @class */ (function () {
    function DoomFlatFolder(name, children) {
        this.name = name;
        this.children = children;
        this.childLookup = new Map();
        this.pictureLookup = new Map();
        this.subFolders = [];
        this.pictureCount = 0;
        for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
            var child = children_1[_i];
            this.childLookup.set(child.name, child);
            if (child instanceof DoomPicture) {
                this.pictureLookup.set(child.name, child);
                this.pictureCount++;
            }
            else {
                this.subFolders.push(child);
            }
        }
    }
    DoomFlatFolder.prototype.getSize = function (recurse) {
        if (recurse === void 0) { recurse = false; }
        if (recurse) {
            return this.children.map(function (child) {
                if (child instanceof DoomFlatFolder) {
                    return 1 + child.getSize(recurse);
                }
                else {
                    return 1;
                }
            }).reduce(function (a, b) { return a + b; });
        }
        return this.children.length;
    };
    DoomFlatFolder.prototype.getPictureCount = function (recurse) {
        if (recurse === void 0) { recurse = false; }
        if (recurse) {
            return this.children.map(function (child) {
                if (child instanceof DoomFlatFolder) {
                    return child.getPictureCount(recurse);
                }
                else {
                    return 1;
                }
            }).reduce(function (a, b) { return a + b; });
        }
        return this.pictureCount;
    };
    DoomFlatFolder.prototype.getChild = function (name) {
        return this.childLookup.get(name);
    };
    DoomFlatFolder.prototype.getPicture = function (name, recurse) {
        if (recurse === void 0) { recurse = false; }
        var picture = this.pictureLookup.get(name);
        if (picture === undefined && recurse) {
            for (var _i = 0, _a = this.subFolders; _i < _a.length; _i++) {
                var folder = _a[_i];
                picture = folder.getPicture(name, recurse);
                if (picture !== undefined) {
                    return picture;
                }
            }
        }
        return picture;
    };
    DoomFlatFolder.parse = function (dict) {
        function parseTree(dict, name, lumpIndex) {
            var children = [];
            while (lumpIndex < dict.length) {
                var lump = dict[lumpIndex];
                var lumpName = lump.name;
                var folderStartMatch = DoomFlatFolder.FlatFolderStartPattern.exec(lumpName);
                var folderEndMatch = DoomFlatFolder.FlatFolderEndPattern.exec(lumpName);
                if (folderStartMatch !== null) {
                    var folderStartName = folderStartMatch[1];
                    var _a = parseTree(dict, folderStartName, lumpIndex + 1), newLumpIndex = _a[0], folder_1 = _a[1];
                    children.push(folder_1);
                    lumpIndex = newLumpIndex;
                }
                else if (folderEndMatch !== null) {
                    var folderEndName = folderEndMatch[1];
                    if (name != folderEndName) {
                        throw "Folder end (" + folderEndName + ") mismatched folder start (" + name + ")!";
                    }
                    return [lumpIndex + 1, new DoomFlatFolder(name, children)];
                }
                else {
                    children.push(DoomPicture.fromFlat(lumpName, dict[lumpIndex].data));
                    lumpIndex++;
                }
            }
            return [lumpIndex, new DoomFlatFolder(name, children)];
        }
        var lumpIndex = DoomGame.findLumpIndex(dict, DoomFlatFolder.RootLumpName);
        var _a = parseTree(dict, DoomFlatFolder.RootName, lumpIndex + 1), folder = _a[1];
        return folder;
    };
    DoomFlatFolder.RootName = "F";
    DoomFlatFolder.RootLumpName = DoomFlatFolder.RootName + "_START";
    DoomFlatFolder.FlatFolderStartPattern = /(F\d*)_START/;
    DoomFlatFolder.FlatFolderEndPattern = /(F\d*)_END/;
    return DoomFlatFolder;
}());
var DoomTextureMap = /** @class */ (function () {
    function DoomTextureMap(textures) {
        this.textures = textures;
    }
    DoomTextureMap.prototype.getTexture = function (name) {
        var tex = this.textures.get(name);
        if (tex === undefined) {
            return null;
        }
        return tex;
    };
    DoomTextureMap.prototype.getSize = function () {
        return this.textures.size;
    };
    return DoomTextureMap;
}());
var DoomTexture = /** @class */ (function () {
    function DoomTexture(name, masked, width, height, patches) {
        this.name = name;
        this.masked = masked;
        this.width = width;
        this.height = height;
        this.patches = patches;
    }
    DoomTexture.parse = function (buf, offset, patches) {
        var name = readASCIIString(buf, offset, WADLump.NameLength);
        var masked = readU32LE(buf, offset + WADLump.NameLength) !== 0;
        var width = readU16LE(buf, offset + 12);
        var height = readU16LE(buf, offset + 14);
        // 4 bytes for "columndirectory", seems to be unused
        var patchCount = readU16LE(buf, offset + 20);
        var texturePatches = new Array(patchCount);
        for (var i = 0; i < patchCount; ++i) {
            texturePatches[i] = DoomTexturePatch.parse(buf, offset + 22 + (DoomTexturePatch.StructSize * i), patches);
        }
        return new DoomTexture(name, masked, width, height, texturePatches);
    };
    return DoomTexture;
}());
var DoomTexturePatch = /** @class */ (function () {
    function DoomTexturePatch(originX, originY, patch) {
        this.originX = originX;
        this.originY = originY;
        this.patch = patch;
    }
    DoomTexturePatch.parse = function (buf, offset, patches) {
        var offsetX = readI16LE(buf, offset);
        var offsetY = readI16LE(buf, offset + 2);
        var patchIndex = readU16LE(buf, offset + 4);
        // 2 more fields, which are not used/known: stepdir, colormap
        return new DoomTexturePatch(offsetX, offsetY, patches.getPatch(patchIndex));
    };
    DoomTexturePatch.StructSize = 10;
    return DoomTexturePatch;
}());
var DoomSpriteSet = /** @class */ (function () {
    function DoomSpriteSet(prefix, billboardSet, orientations) {
        this.prefix = prefix;
        this.billboardSet = billboardSet;
        this.orientationSets = orientations;
    }
    DoomSpriteSet.parse = function (dict, prefix) {
        function framesAndOrientations(name) {
            var codeA = "A".charCodeAt(0);
            var configs = [];
            var offset = 4;
            while (offset <= name.length) {
                var frame = name.charCodeAt(offset) - codeA;
                var orientation_1 = parseInt(name.charAt(offset + 1));
                configs.push([frame, orientation_1]);
                offset += 2;
            }
            return configs;
        }
        var billboardSet = [];
        var orientationSets = [];
        for (var _i = 0, dict_1 = dict; _i < dict_1.length; _i++) {
            var lump = dict_1[_i];
            if (!lump.name.startsWith(prefix)) {
                continue;
            }
            var result = framesAndOrientations(lump.name);
            if (result.length > 0) {
                var picture = DoomPicture.fromPatch(lump.name, lump.data);
                for (var _a = 0, result_1 = result; _a < result_1.length; _a++) {
                    var _b = result_1[_a], frame = _b[0], orientation_2 = _b[1];
                    if (orientation_2 === 0) {
                        billboardSet[frame] = picture;
                    }
                    else {
                        var orientationIndex = orientation_2 - 1;
                        var orientationSet = orientationSets[orientationIndex];
                        if (!Array.isArray(orientationSet)) {
                            orientationSet = [];
                            orientationSets[orientationIndex] = orientationSet;
                        }
                        orientationSet[frame] = picture;
                    }
                }
            }
        }
        return new DoomSpriteSet(prefix, billboardSet, orientationSets);
    };
    return DoomSpriteSet;
}());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1kYXRhLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZ2FtZS1kYXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0lBYUksa0JBQVksR0FBUSxFQUFFLFFBQXdCLEVBQUUsWUFBMkIsRUFBRSxPQUFxQixFQUFFLEtBQXFCLEVBQUUsUUFBd0IsRUFBRSxJQUFlO1FBSjNKLFNBQUksR0FBRyxXQUFXLEVBQUUsQ0FBQTtRQUt6QixJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQTtRQUNkLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFBO1FBQ3pCLElBQUksQ0FBQyxhQUFhLEdBQUcsWUFBWSxDQUFBO1FBQ2pDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFBO1FBQ3RCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFBO1FBQ2xCLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFBO1FBQ3hCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFBO1FBQ2hCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUE7UUFDaEQsS0FBZ0IsVUFBSSxFQUFKLGFBQUksRUFBSixrQkFBSSxFQUFKLElBQUksRUFBRTtZQUFqQixJQUFJLEdBQUcsYUFBQTtZQUNSLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUE7U0FDcEM7SUFDTCxDQUFDO0lBRUQseUJBQU0sR0FBTixVQUFPLElBQWlCO1FBQ3BCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUE7SUFDbkMsQ0FBQztJQUVELDJCQUFRLEdBQVIsVUFBUyxJQUFZO1FBQ2pCLE9BQU8sUUFBUSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE9BQUssSUFBTSxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtJQUN2RSxDQUFDO0lB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