function compileShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var infoLog = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('An error occurred compiling the shaders: ' + infoLog);
    }
    return shader;
}
function loadShader(gl, baseName, attributes, uniforms) {
    function location(name, type) {
        switch (type) {
            case gl.VERTEX_SHADER:
                return name + ".vert";
            case gl.FRAGMENT_SHADER:
                return name + ".frag";
            default:
                throw "unknown type";
        }
    }
    function compile(as) {
        return function (source) { return compileShader(gl, as, source); };
    }
    var vertex = fetch(location(baseName, gl.VERTEX_SHADER))
        .then(function (response) { return response.text(); })
        .then(compile(gl.VERTEX_SHADER));
    var fragment = fetch(location(baseName, gl.FRAGMENT_SHADER))
        .then(function (response) { return response.text(); })
        .then(compile(gl.FRAGMENT_SHADER));
    return Promise.all([vertex, fragment]).then(function (_a) {
        var vertexShader = _a[0], fragmentShader = _a[1];
        var shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            var infoLog = gl.getProgramInfoLog(shaderProgram);
            gl.deleteProgram(shaderProgram);
            throw new Error('Unable to initialize the shader program: ' + infoLog);
        }
        var shader = {
            program: shaderProgram,
            attribute: {},
            uniform: {},
        };
        for (var _i = 0, attributes_1 = attributes; _i < attributes_1.length; _i++) {
            var attribute = attributes_1[_i];
            shader.attribute[attribute] = gl.getAttribLocation(shaderProgram, attribute);
        }
        for (var _b = 0, uniforms_1 = uniforms; _b < uniforms_1.length; _b++) {
            var uniform = uniforms_1[_b];
            shader.uniform[uniform] = gl.getUniformLocation(shaderProgram, uniform);
        }
        return shader;
    });
}
var Renderer = /** @class */ (function () {
    function Renderer(cameraTransform) {
        this.mapLoaded = false;
        this.fov = deg2rad(90);
        this.near = 0.1;
        this.far = 10000;
        this.colorPalette = 0;
        this.things = [];
        this.camera = cameraTransform;
        this.sky = 0;
    }
    Renderer.prototype.initRenderer = function () {
        var _this = this;
        this.canvas = document.querySelector("canvas");
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        var aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.projectionMatrix = mat4.perspective(this.fov, aspect, this.near, this.far);
        this.webgl = this.canvas.getContext("webgl2");
        var gl = this.webgl;
        if (gl == null) {
            alert("Unable to initialize WebGL!");
            return;
        }
        // FIXME it seems that our triangle winding directions are inconsistent. expected winding would be counter-clockwise
        // gl.enable(gl.CULL_FACE)
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        var shaders = [
            loadShader(gl, "shaders/simple", ["vertexPosition", "textureCoord", "lightLevel"], ["modelMatrix", "viewMatrix", "projectionMatrix", "atlasSampler", "colorMapsSampler", "palettesSampler", "colorPalette"]),
            loadShader(gl, "shaders/simpler", ["coordinates", "colors"], ["modelMatrix", "viewMatrix", "projectionMatrix"]),
        ];
        this.buffers = {
            vertices: gl.createBuffer(),
            triangles: gl.createBuffer(),
            textureCoords: gl.createBuffer(),
            textureBoundaries: gl.createBuffer(),
            textureTiling: gl.createBuffer(),
            lightLevels: gl.createBuffer()
        };
        return Promise.all(shaders).then(function (shaders) {
            _this.shaders = shaders;
        });
    };
    Renderer.prototype.loadColorMaps = function (colorMaps) {
        var arraySize = colorMaps.length * DoomColorMap.MapSize;
        var colorMapsArray = [arraySize];
        for (var i = 0; i < arraySize; i++) {
            colorMapsArray[i] = 0;
        }
        for (var i = 0; i < colorMaps.length; i++) {
            var colorMap = colorMaps[i].map;
            for (var j = 0; j < colorMap.length; j++) {
                colorMapsArray[i * DoomColorMap.MapSize + j] = colorMap[j];
            }
        }
        var colorMapsUint8Array = new Uint8Array(colorMapsArray);
        this.colorMapsTexture = this.createSingleChannelUint8Texture(DoomColorMap.MapSize, colorMaps.length, colorMapsUint8Array);
        this.colorMapCount = colorMaps.length;
    };
    Renderer.prototype.loadPalettes = function (palettes) {
        var arraySize = palettes.length * DoomPalette.Colors * DoomPalette.Channels;
        var paletteArray = [arraySize];
        for (var i = 0; i < arraySize; i++) {
            paletteArray[i] = 0;
        }
        for (var i = 0; i < palettes.length; i++) {
            var palette = palettes[i].colors;
            for (var j = 0; j < palette.length; j++) {
                for (var k = 0; k < DoomPalette.Channels; k++) {
                    paletteArray[i * DoomPalette.Colors * DoomPalette.Channels + j * DoomPalette.Channels + k] = palette[j][k];
                }
            }
        }
        console.log(paletteArray);
        var paletteUint8Array = new Uint8Array(paletteArray);
        var gl = this.webgl;
        var palettesTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, palettesTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8UI, DoomPalette.Colors, palettes.length, 0, gl.RGB_INTEGER, gl.UNSIGNED_BYTE, paletteUint8Array);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        this.palettesTexture = palettesTexture;
    };
    Renderer.prototype.loadTextures = function (textures, skies) {
        var atlasWidth = 2048;
        var atlasHeight = 2048;
        var rowHeight = 128;
        var atlas = new Uint8Array(atlasWidth * atlasHeight);
        var atlasBoundaryLookup = new Map();
        for (var i = 0; i < atlasWidth * atlasHeight; i++) {
            atlas[i] = 0;
        }
        var atlasX = 0;
        var atlasY = 0;
        textures.forEach(function (texture, name) {
            if (atlasWidth < atlasX + texture.width) {
                atlasX = 0;
                atlasY += rowHeight;
            }
            atlasBoundaryLookup.set(name, [atlasX / atlasWidth, atlasY / atlasHeight,
                texture.width / atlasWidth, texture.height / atlasHeight]);
            for (var x = 0; x < texture.width; x++) {
                for (var y = 0; y < texture.height; y++) {
                    for (var p = 0; p < texture.patches.length; p++) {
                        var patch = texture.patches[p];
                        var pX = x - patch.originX; //+ patch.patch.offsetX - (patch.patch.width / 2 - 1)
                        var pY = y - patch.originY; //+ awpatch.patch.offsetY - (patch.patch.height - 5)
                        if (pX >= 0 && pX < patch.patch.width && pY >= 0 && pY < patch.patch.height) {
                            atlas[(atlasY + y) * atlasWidth + atlasX + x] =
                                patch.patch.pixels[pY * patch.patch.width + pX];
                        }
                    }
                }
            }
            atlasX += texture.width;
        });
        console.log("Texture atlas created.");
        this.wallAtlas = {
            texture: this.createSingleChannelUint8Texture(atlasWidth, atlasHeight, atlas),
            boundaryLookup: atlasBoundaryLookup
        };
        var skyWidth = skies[0].width;
        var skyHeight = skies[0].height;
        var skyLength = skyWidth * skyHeight;
        var _a = [skyWidth, skyHeight * skies.length], skyAtlasWidth = _a[0], skyAtlasHeight = _a[1];
        var skyAtlasPixels = new Uint8Array(skyAtlasWidth * skyAtlasHeight);
        var skyAtlasBoundaryLookup = new Map();
        for (var skyIndex = 0; skyIndex < skies.length; ++skyIndex) {
            var sky = skies[skyIndex];
            skyAtlasBoundaryLookup.set(sky.name, [0, (skyHeight * skyIndex) / skyAtlasHeight, skyWidth / skyAtlasWidth, skyHeight / skyAtlasHeight]);
            var len = sky.width * sky.height;
            for (var i = 0; i < len; ++i) {
                skyAtlasPixels[skyIndex * skyLength + i] = sky.pixels[i];
            }
        }
        this.skyAtlas = {
            texture: this.createSingleChannelUint8Texture(skyAtlasWidth, skyAtlasHeight, skyAtlasPixels),
            boundaryLookup: skyAtlasBoundaryLookup,
        };
    };
    Renderer.prototype.createSingleChannelUint8Texture = function (width, height, pixelData) {
        var gl = this.webgl;
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, width, height, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, pixelData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        return texture;
    };
    Renderer.prototype.fill = function (buffer, data) {
        var gl = this.webgl;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    };
    Renderer.prototype.loadMap = function (map) {
        var vertices = [];
        var triangles = [];
        var textureCoords = [];
        var textureBoundaries = [];
        var textureTiling = [];
        var lightLevels = [];
        function loadSideDef(sideDef, startVertex, endVertex, sector, twoSided, otherSector, boundaryLookup, colorMapCount) {
            var floorHeight = sector.floorHeight;
            var ceilHeight = sector.ceilingHeight;
            var lightLevel = sector.lightLevel;
            function addQuad(left, right, top, bottom, textureName, colorMapCount) {
                var prevVertexCount = vertices.length / 3;
                vertices = vertices.concat([left[1], top, left[0]]);
                vertices = vertices.concat([left[1], bottom, left[0]]);
                vertices = vertices.concat([right[1], top, right[0]]);
                vertices = vertices.concat([right[1], bottom, right[0]]);
                var triangleOffsets = [0, 1, 2, 1, 2, 3];
                for (var _i = 0, triangleOffsets_1 = triangleOffsets; _i < triangleOffsets_1.length; _i++) {
                    var triangleOffset = triangleOffsets_1[_i];
                    triangles.push(prevVertexCount + triangleOffset);
                }
                var textureBoundary = boundaryLookup.get(textureName);
                var bLeft = textureBoundary[0];
                var bTop = textureBoundary[1];
                var bWidth = textureBoundary[2];
                var bHeight = textureBoundary[3];
                textureCoords = textureCoords.concat([
                    bLeft, bTop,
                    bLeft, bTop + bHeight,
                    bLeft + bWidth, bTop,
                    bLeft + bWidth, bTop + bHeight
                ]);
                for (var v = 0; v < 4; v++) {
                    textureBoundaries = textureBoundaries.concat(textureBoundary);
                    textureTiling = textureTiling.concat([1, 1]);
                    lightLevels = lightLevels.concat(31 - Math.floor(lightLevel / 8));
                }
            }
            if (sideDef.middleTexture != null) {
                addQuad(startVertex, endVertex, ceilHeight, floorHeight, sideDef.middleTexture.name, colorMapCount);
            }
            if (twoSided) {
                var otherCeilHeight = otherSector.ceilingHeight;
                var otherFloorHeight = otherSector.floorHeight;
                if (ceilHeight > otherCeilHeight && sideDef.upperTexture != null) {
                    addQuad(startVertex, endVertex, ceilHeight, otherCeilHeight, sideDef.upperTexture.name, colorMapCount);
                }
                if (floorHeight < otherFloorHeight && sideDef.lowerTexture != null) {
                    addQuad(startVertex, endVertex, otherFloorHeight, floorHeight, sideDef.lowerTexture.name, colorMapCount);
                }
            }
        }
        for (var _i = 0, _a = map.lineDefs; _i < _a.length; _i++) {
            var lineDef = _a[_i];
            var startVertex = map.vertexes[lineDef.startVertexIndex];
            var endVertex = map.vertexes[lineDef.endVertexIndex];
            var twoSided = (lineDef.flags & 4) > 0;
            var right = false;
            var rightSideDef = void 0;
            var rightSector = void 0;
            if (lineDef.rightSideDefIndex > -1) {
                right = true;
                rightSideDef = map.sideDefs[lineDef.rightSideDefIndex];
                rightSector = map.sectors[rightSideDef.sectorIndex];
            }
            var left = false;
            var leftSideDef = void 0;
            var leftSector = void 0;
            if (lineDef.leftSideDefIndex > -1) {
                left = true;
                leftSideDef = map.sideDefs[lineDef.leftSideDefIndex];
                leftSector = map.sectors[leftSideDef.sectorIndex];
            }
            if (right) {
                loadSideDef(rightSideDef, startVertex, endVertex, rightSector, twoSided, leftSector, this.wallAtlas.boundaryLookup, this.colorMapCount);
            }
            if (left) {
                loadSideDef(leftSideDef, endVertex, startVertex, leftSector, twoSided, rightSector, this.wallAtlas.boundaryLookup, this.colorMapCount);
            }
        }
        this.triangleCount = triangles.length;
        var gl = this.webgl;
        this.fill(this.buffers.vertices, vertices);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.triangles);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangles), gl.STATIC_DRAW);
        this.fill(this.buffers.textureCoords, textureCoords);
        this.fill(this.buffers.textureBoundaries, textureBoundaries);
        this.fill(this.buffers.textureTiling, textureTiling);
        this.fill(this.buffers.lightLevels, lightLevels);
        this.mapLoaded = true;
    };
    Renderer.prototype.setupAttrib = function (shader, name, buffer, size) {
        var gl = this.webgl;
        var attribute = this.shaders[shader].attribute[name];
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attribute);
    };
    Renderer.prototype.render = function (dt) {
        var gl = this.webgl;
        gl.clearColor(.2, .2, .2, 1);
        gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this.renderSky(gl, this.sky);
        this.setupAttrib(0, "vertexPosition", this.buffers.vertices, 3);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.triangles);
        this.setupAttrib(0, "textureCoord", this.buffers.textureCoords, 2);
        this.setupAttrib(0, "lightLevel", this.buffers.lightLevels, 1);
        gl.useProgram(this.shaders[0].program);
        gl.uniformMatrix4fv(this.shaders[0].uniform["modelMatrix"], false, mat4.identity);
        gl.uniformMatrix4fv(this.shaders[0].uniform["viewMatrix"], false, this.camera.getTransformation());
        gl.uniformMatrix4fv(this.shaders[0].uniform["projectionMatrix"], false, this.projectionMatrix);
        gl.uniform1ui(this.shaders[0].uniform["colorPalette"], Math.floor(this.colorPalette += dt) % 14);
        this.bindTexture(this.wallAtlas.texture, 0, 0, "atlasSampler");
        this.bindTexture(this.colorMapsTexture, 1, 0, "colorMapsSampler");
        this.bindTexture(this.palettesTexture, 2, 0, "palettesSampler");
        if (this.mapLoaded) {
            gl.drawElements(gl.TRIANGLES, this.triangleCount, gl.UNSIGNED_SHORT, 0);
        }
        this.renderThings(gl);
        this.renderCoordSystem(gl);
    };
    Renderer.prototype.renderSky = function (gl, sky) {
        var rf = this.cameraYaw / (Math.PI / 2);
        var heightPart = 0.5;
        var lowerEnd = 1 - 2 * heightPart;
        var vertices = [
            -1, 1, 1, -1, lowerEnd, 1, 1, 1, 1,
            -1, lowerEnd, 1, 1, lowerEnd, 1, 1, 1, 1,
        ];
        var skyboxCount = this.skyAtlas.boundaryLookup.size;
        var texCoords = [
            rf, sky / skyboxCount, rf, (sky + 1) / skyboxCount, 1 + rf, sky / skyboxCount,
            rf, (sky + 1) / skyboxCount, 1 + rf, (sky + 1) / skyboxCount, 1 + rf, sky / skyboxCount,
        ];
        var vertexBuffer = gl.createBuffer(); // Create an empty buffer object
        this.setupAttrib(0, "vertexPosition", vertexBuffer, 3);
        this.fill(vertexBuffer, vertices);
        var texCoordBuffer = gl.createBuffer(); // Create an empty buffer object
        this.setupAttrib(0, "textureCoord", texCoordBuffer, 2);
        this.fill(texCoordBuffer, texCoords);
        gl.useProgram(this.shaders[0].program);
        gl.uniformMatrix4fv(this.shaders[0].uniform["modelMatrix"], false, mat4.identity);
        gl.uniformMatrix4fv(this.shaders[0].uniform["viewMatrix"], false, mat4.identity);
        gl.uniformMatrix4fv(this.shaders[0].uniform["projectionMatrix"], false, mat4.identity);
        this.bindTexture(this.skyAtlas.texture, 0, 0, "atlasSampler");
        this.bindTexture(this.colorMapsTexture, 1, 0, "colorMapsSampler");
        this.bindTexture(this.palettesTexture, 2, 0, "palettesSampler");
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 3);
    };
    Renderer.prototype.bindTexture = function (texture, textureUnit, shader, uniform) {
        var gl = this.webgl;
        // this works, see: https://www.khronos.org/registry/OpenGL-Refpages/es1.1/xhtml/glActiveTexture.xml
        gl.activeTexture(gl.TEXTURE0 + textureUnit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(this.shaders[shader].uniform[uniform], textureUnit);
    };
    Renderer.prototype.renderThings = function (gl) {
        for (var _i = 0, _a = this.things; _i < _a.length; _i++) {
            var thing = _a[_i];
            this.renderCoordSystem(gl, 20, thing);
        }
    };
    Renderer.prototype.renderCoordSystem = function (gl, size, transform) {
        if (size === void 0) { size = 50000; }
        if (transform === void 0) { transform = undefined; }
        var vertices = [
            0, 0, 0, size, 0, 0,
            0, 0, 0, 0, size, 0,
            0, 0, 0, 0, 0, size
        ];
        var colors = [
            1, 0, 0, 1, 0.6, 0,
            0, 1, 0, 0.6, 1, 0,
            0, 0, 1, 0, 0.6, 1
        ];
        var vertexBuffer = gl.createBuffer(); // Create an empty buffer object
        this.setupAttrib(1, "coordinates", vertexBuffer, 3);
        this.fill(vertexBuffer, vertices);
        var colorBuffer = gl.createBuffer(); // Create an empty buffer object
        this.setupAttrib(1, "colors", colorBuffer, 3);
        this.fill(colorBuffer, colors);
        gl.useProgram(this.shaders[1].program);
        gl.uniformMatrix4fv(this.shaders[1].uniform["modelMatrix"], false, transform ? mat4.invert(transform.getTransformation()) : mat4.identity);
        gl.uniformMatrix4fv(this.shaders[1].uniform["viewMatrix"], false, this.camera.getTransformation());
        gl.uniformMatrix4fv(this.shaders[1].uniform["projectionMatrix"], false, this.projectionMatrix);
        gl.drawArrays(gl.LINES, 0, vertices.length / 3);
    };
    Renderer.prototype.addThing = function (transform) {
        this.things.push(transform);
    };
    return Renderer;
}());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZW5kZXJlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLGFBQWEsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU07SUFDbkMsSUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUNwQyxFQUFFLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQTtJQUMvQixFQUFFLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFBO0lBRXhCLElBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxjQUFjLENBQUMsRUFBRTtRQUNuRCxJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDekMsRUFBRSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLDJDQUEyQyxHQUFHLE9BQU8sQ0FBQyxDQUFBO0tBQ3pFO0lBRUQsT0FBTyxNQUFNLENBQUE7QUFDakIsQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLEVBQUUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFFBQVE7SUFDbEQsU0FBUyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUk7UUFDeEIsUUFBUSxJQUFJLEVBQUU7WUFDVixLQUFLLEVBQUUsQ0FBQyxhQUFhO2dCQUNqQixPQUFVLElBQUksVUFBTyxDQUFBO1lBQ3pCLEtBQUssRUFBRSxDQUFDLGVBQWU7Z0JBQ25CLE9BQVUsSUFBSSxVQUFPLENBQUE7WUFDekI7Z0JBQ0ksTUFBTSxjQUFjLENBQUE7U0FDM0I7SUFDTCxDQUFDO0lBRUQsU0FBUyxPQUFPLENBQUMsRUFBRTtRQUNmLE9BQU8sVUFBQSxNQUFNLElBQUksT0FBQSxhQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxN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