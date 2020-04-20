function compileShader(gl, type, source) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        let infoLog = gl.getShaderInfoLog(shader)
        gl.deleteShader(shader)
        throw new Error('An error occurred compiling the shaders: ' + infoLog)
    }

    return shader
}

function loadShader(gl, baseName, attributes, uniforms) {
    function location(name, type) {
        switch (type) {
            case gl.VERTEX_SHADER:
                return `${name}.vert`
            case gl.FRAGMENT_SHADER:
                return `${name}.frag`
            default:
                throw "unknown type"
        }
    }

    function compile(as) {
        return source => compileShader(gl, as, source)
    }

    let vertex = fetch(location(baseName, gl.VERTEX_SHADER))
        .then(response => response.text())
        .then(compile(gl.VERTEX_SHADER))

    let fragment = fetch(location(baseName, gl.FRAGMENT_SHADER))
        .then(response => response.text())
        .then(compile(gl.FRAGMENT_SHADER))

    return Promise.all([vertex, fragment]).then(([vertexShader, fragmentShader]) => {
        const shaderProgram = gl.createProgram()
        gl.attachShader(shaderProgram, vertexShader)
        gl.attachShader(shaderProgram, fragmentShader)
        gl.linkProgram(shaderProgram)

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            let infoLog = gl.getProgramInfoLog(shaderProgram)
            gl.deleteProgram(shaderProgram)
            throw new Error('Unable to initialize the shader program: ' + infoLog)
        }

        let shader = {
            program: shaderProgram,
            attribute: {},
            uniform: {},
        }

        for (let attribute of attributes) {
            shader.attribute[attribute] = gl.getAttribLocation(shaderProgram, attribute)
        }

        for (let uniform of uniforms) {
            shader.uniform[uniform] = gl.getUniformLocation(shaderProgram, uniform)
        }

        return shader
    })
}

class Renderer {
    shaders: {program: any, attribute: {}, uniform: {}}[]
    canvas: HTMLCanvasElement
    webgl: WebGL2RenderingContext
    buffers
    atlas
    colorMapsTexture
    colorMapCount
    palettesTexture
    camera: Transform
    triangleCount: number

    mapLoaded: boolean = false

    readonly fov = deg2rad(90)
    readonly near = 0.1
    readonly far = 10000
    projectionMatrix: number[]

    constructor(cameraTransform: Transform) {
        this.camera = cameraTransform
    }

    initRenderer() {
        this.canvas = document.querySelector("canvas")
        this.canvas.width = this.canvas.clientWidth
        this.canvas.height = this.canvas.clientHeight

        const aspect = this.canvas.clientWidth / this.canvas.clientHeight
        this.projectionMatrix = mat4.perspective(this.fov, aspect, this.near, this.far)

        this.webgl = this.canvas.getContext("webgl2")
        let gl = this.webgl

        if (gl == null) {
            alert("Unable to initialize WebGL!")
            return
        }

        gl.enable(gl.DEPTH_TEST)
        gl.depthFunc(gl.LEQUAL)

        let shaders = [
            loadShader(gl, "shaders/simple",
                ["vertexPosition", "textureCoord", "lightLevel"],
                ["modelMatrix", "viewMatrix", "projectionMatrix", "atlasSampler", "colorMapsSampler", "palettesSampler", "colorPalette"]),
            loadShader(gl, "shaders/simpler",
                ["coordinates", "colors"],
                ["modelMatrix", "viewMatrix", "projectionMatrix"])
        ]

        this.buffers = {
            vertices: gl.createBuffer(),
            triangles: gl.createBuffer(),
            textureCoords: gl.createBuffer(),
            textureBoundaries: gl.createBuffer(),
            textureTiling: gl.createBuffer(),
            lightLevels: gl.createBuffer()
        }

        return Promise.all(shaders).then(shaders => {
            this.shaders = shaders
        })
    }

    loadColorMaps(colorMaps: DoomColorMap[]) {
        let arraySize = colorMaps.length * DoomColorMap.MapSize
        let colorMapsArray = [arraySize]
        for (let i = 0; i < arraySize; i++) {
            colorMapsArray[i] = 0
        }
        for (let i = 0; i < colorMaps.length; i++) {
            let colorMap = colorMaps[i].map
            for (let j = 0; j < colorMap.length; j++) {
                colorMapsArray[i * DoomColorMap.MapSize + j] = colorMap[j]
            }
        }

        let colorMapsUint8Array = new Uint8Array(colorMapsArray)

        let gl = this.webgl

        const colorMapsTexture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, colorMapsTexture)

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, DoomColorMap.MapSize, colorMaps.length, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, colorMapsUint8Array)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)

        this.colorMapsTexture = colorMapsTexture
        this.colorMapCount = colorMaps.length
    }

    loadPalettes(palettes: DoomPalette[]) {
        let arraySize = palettes.length * DoomPalette.Colors * DoomPalette.Channels
        let paletteArray = [arraySize]
        for (let i = 0; i < arraySize; i++) {
            paletteArray[i] = 0
        }
        for (let i = 0; i < palettes.length; i++) {
            let palette = palettes[i].colors
            for (let j = 0; j < palette.length; j++) {
                for (let k = 0; k < DoomPalette.Channels; k++) {
                    paletteArray[i * DoomPalette.Colors * DoomPalette.Channels + j * DoomPalette.Channels + k] = palette[j][k]
                }
            }
        }

        console.log(paletteArray)

        let paletteUint8Array = new Uint8Array(paletteArray)

        let gl = this.webgl

        const palettesTexture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, palettesTexture)

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8UI, DoomPalette.Colors, palettes.length, 0, gl.RGB_INTEGER,
            gl.UNSIGNED_BYTE, paletteUint8Array)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)

        this.palettesTexture = palettesTexture
    }

    loadTextures(textures: Map<string, DoomTexture>) {
        const atlasWidth = 2048
        const atlasHeight = 2048
        const rowHeight = 128

        let atlas = new Array(atlasWidth * atlasHeight)
        let atlasBoundaryLookup = {}

        for (let i = 0; i < atlasWidth * atlasHeight; i++) {
            atlas[i] = 0
        }

        let atlasX = 0
        let atlasY = 0

        textures.forEach((texture, name) => {
            if (atlasWidth < atlasX + texture.width) {
                atlasX = 0
                atlasY += rowHeight
            }

            atlasBoundaryLookup[name] = [atlasX / atlasWidth, atlasY / atlasHeight,
                texture.width / atlasWidth, texture.height / atlasHeight]

            for (let x = 0; x < texture.width; x++) {
                for (let y = 0; y < texture.height; y++) {
                    for (let p = 0; p < texture.patches.length; p++) {
                        let patch = texture.patches[p]
                        let pX = x - patch.originX //+ patch.patch.offsetX - (patch.patch.width / 2 - 1)
                        let pY = y - patch.originY //+ awpatch.patch.offsetY - (patch.patch.height - 5)
                        if (pX >= 0 && pX < patch.patch.width && pY >= 0 && pY < patch.patch.height) {
                            atlas[(atlasY + y) * atlasWidth + atlasX + x] =
                                patch.patch.pixels[pY * patch.patch.width + pX]
                        }
                    }
                }
            }

            atlasX += texture.width
        });

        console.log("Texture atlas created.")

        let pixels = new Uint8Array(atlas)

        let gl = this.webgl

        const atlasTexture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, atlasTexture)

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, atlasWidth, atlasHeight, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, pixels)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)

        this.atlas = {
            texture: atlasTexture,
            boundaryLookup: atlasBoundaryLookup
        }
    }

    private fill(buffer, data) {
        let gl = this.webgl;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
    }

    loadMap(map) {
        let vertices = []
        let triangles = []
        let textureCoords = []
        let textureBoundaries = []
        let textureTiling = []
        let lightLevels = []

        function loadSideDef(sideDef: DoomSideDef, startVertex: DoomVertex, endVertex: DoomVertex, sector: DoomSector,
                             twoSided, otherSector: DoomSector, boundaryLookup, colorMapCount) {
            let floorHeight = sector.floorHeight
            let ceilHeight = sector.ceilingHeight
            let lightLevel = sector.lightLevel

            function addQuad(left, right, top, bottom, textureName, colorMapCount) {
                let prevVertexCount = vertices.length / 3

                vertices = vertices.concat([left[1], top, left[0]])
                vertices = vertices.concat([left[1], bottom, left[0]])
                vertices = vertices.concat([right[1], top, right[0]])
                vertices = vertices.concat([right[1], bottom, right[0]])

                let triangleOffsets = [0, 1, 2, 1, 2, 3]
                for (let triangleOffset of triangleOffsets) {
                    triangles.push(prevVertexCount + triangleOffset)
                }

                let textureBoundary = boundaryLookup[textureName]
                let bLeft = textureBoundary[0]
                let bTop = textureBoundary[1]
                let bWidth = textureBoundary[2]
                let bHeight = textureBoundary[3]
                textureCoords = textureCoords.concat([
                    bLeft, bTop,
                    bLeft, bTop + bHeight,
                    bLeft + bWidth, bTop,
                    bLeft + bWidth, bTop + bHeight
                ])
                for (let v = 0; v < 4; v++) {
                    textureBoundaries = textureBoundaries.concat(textureBoundary)
                    textureTiling = textureTiling.concat([1, 1])
                    lightLevels = lightLevels.concat(31 - Math.floor(lightLevel / 8))
                }
            }

            if (sideDef.middleTexture != null) {
                addQuad(startVertex, endVertex, ceilHeight, floorHeight, sideDef.middleTexture.name, colorMapCount)
            }

            if (twoSided) {
                let otherCeilHeight = otherSector.ceilingHeight
                let otherFloorHeight = otherSector.floorHeight
                if (ceilHeight > otherCeilHeight && sideDef.upperTexture != null) {
                    addQuad(startVertex, endVertex, ceilHeight, otherCeilHeight, sideDef.upperTexture.name, colorMapCount)
                }
                if (floorHeight < otherFloorHeight && sideDef.lowerTexture != null) {
                    addQuad(startVertex, endVertex, otherFloorHeight, floorHeight, sideDef.lowerTexture.name, colorMapCount)
                }
            }
        }

        for (let lineDef of map.lineDefs) {
            let startVertex = map.vertexes[lineDef.startVertexIndex]
            let endVertex = map.vertexes[lineDef.endVertexIndex]

            let twoSided = (lineDef.flags & 4) > 0

            let right = false
            let rightSideDef
            let rightSector
            if (lineDef.rightSideDefIndex > -1) {
                right = true
                rightSideDef = map.sideDefs[lineDef.rightSideDefIndex]
                rightSector = map.sectors[rightSideDef.sectorIndex]
            }

            let left = false
            let leftSideDef
            let leftSector
            if (lineDef.leftSideDefIndex > -1) {
                left = true
                leftSideDef = map.sideDefs[lineDef.leftSideDefIndex]
                leftSector = map.sectors[leftSideDef.sectorIndex]
            }

            if (right) {
                loadSideDef(rightSideDef, startVertex, endVertex, rightSector, twoSided, leftSector, this.atlas.boundaryLookup, this.colorMapCount)
            }
            if (left) {
                loadSideDef(leftSideDef, endVertex, startVertex, leftSector, twoSided, rightSector, this.atlas.boundaryLookup, this.colorMapCount)
            }
        }

        this.triangleCount = triangles.length

        let gl = this.webgl

        this.fill(this.buffers.vertices, vertices)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.triangles)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangles), gl.STATIC_DRAW)

        this.fill(this.buffers.textureCoords, textureCoords)
        this.fill(this.buffers.textureBoundaries, textureBoundaries)
        this.fill(this.buffers.textureTiling, textureTiling)
        this.fill(this.buffers.lightLevels, lightLevels)

        this.mapLoaded = true
    }

    private setupAttrib(shader: number, name: string, buffer: WebGLBuffer, size: number): void {
        let gl = this.webgl
        let attribute = this.shaders[shader].attribute[name]
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 0, 0)
        gl.enableVertexAttribArray(attribute)
    }

    colorPalette = 0
    render(dt) {
        let gl = this.webgl

        gl.clearColor(.2, .2, .2, 1)
        gl.clearDepth(1)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        this.setupAttrib(0, "vertexPosition", this.buffers.vertices, 3)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.triangles)

        this.setupAttrib(0, "textureCoord", this.buffers.textureCoords, 2)
        this.setupAttrib(0, "lightLevel", this.buffers.lightLevels, 1)

        gl.useProgram(this.shaders[0].program)

        gl.uniformMatrix4fv(this.shaders[0].uniform["modelMatrix"], false, mat4.identity)
        gl.uniformMatrix4fv(this.shaders[0].uniform["viewMatrix"], false, this.camera.getTransformation())
        gl.uniformMatrix4fv(this.shaders[0].uniform["projectionMatrix"], false, this.projectionMatrix)
        gl.uniform1ui(this.shaders[0].uniform["colorPalette"], Math.floor(this.colorPalette += dt) % 14)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.atlas.texture)
        gl.uniform1i(this.shaders[0].uniform["atlasSampler"], 0)

        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.colorMapsTexture)
        gl.uniform1i(this.shaders[0].uniform["colorMapsSampler"], 1)

        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, this.palettesTexture)
        gl.uniform1i(this.shaders[0].uniform["palettesSampler"], 2)

        if (this.mapLoaded) {
            gl.drawElements(gl.TRIANGLES, this.triangleCount, gl.UNSIGNED_SHORT, 0)
        }

        this.renderCoordSystem(gl)
    }

    private renderCoordSystem(gl) {
        let size = 50000
        let vertices = [
            0, 0, 0,	size, 0, 0,
            0, 0, 0,	0, size, 0,
            0, 0, 0,	0, 0, size
        ];

        let colors = [
            1, 0, 0,	1, 0.6, 0,
            0, 1, 0,	0.6, 1, 0,
            0, 0, 1,	0, 0.6, 1
        ];

        let vertexBuffer = gl.createBuffer(); // Create an empty buffer object
        this.setupAttrib(1, "coordinates", vertexBuffer, 3)
        this.fill(vertexBuffer, vertices)

        let colorBuffer = gl.createBuffer(); // Create an empty buffer object
        this.setupAttrib(1, "colors", colorBuffer, 3)
        this.fill(colorBuffer, colors)

        gl.useProgram(this.shaders[1].program);

        gl.uniformMatrix4fv(this.shaders[1].uniform["modelMatrix"], false, mat4.identity)
        gl.uniformMatrix4fv(this.shaders[1].uniform["viewMatrix"], false, this.camera.getTransformation())
        gl.uniformMatrix4fv(this.shaders[1].uniform["projectionMatrix"], false, this.projectionMatrix)

        gl.drawArrays(gl.LINES, 0, 6);
    }
}

