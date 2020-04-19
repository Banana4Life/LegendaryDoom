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
    textures
    camera: Transform
    triangleCount: number

    mapLoaded: boolean = false

    readonly fov = deg2rad(90)
    readonly near = 0.1
    readonly far = 10000

    constructor(cameraTransform: Transform) {
        this.camera = cameraTransform
    }

    initRenderer() {
        this.canvas = document.querySelector("canvas")
        this.canvas.width = this.canvas.clientWidth
        this.canvas.height = this.canvas.clientHeight

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
                ["vertexPosition", "textureCoord", "textureBoundary", "textureTiling"],
                ["modelMatrix", "viewMatrix", "projectionMatrix", "sampler"])
        ]

        this.buffers = {
            vertices: gl.createBuffer(),
            triangles: gl.createBuffer(),
            textureCoords: gl.createBuffer(),
            textureBoundaries: gl.createBuffer(),
            textureTiling: gl.createBuffer()
        }

        return Promise.all(shaders).then(shaders => {
            this.shaders = shaders
        })
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

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, atlasWidth, atlasHeight, 0, gl.RED, gl.UNSIGNED_BYTE, pixels)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)

        this.textures = {
            atlas: atlasTexture,
            atlasBoundaryLookup: atlasBoundaryLookup
        }
    }

    loadMap(map) {
        let vertices = []
        let triangles = []
        let textureCoords = []
        let textureBoundaries = []
        let textureTiling = []
        let ti = 0

        function loadSideDef(sideDef, startVertex, endVertex, sector, twoSided, otherSector, textures) {
            let floorHeight = sector.floorHeight
            let ceilHeight = sector.ceilingHeight

            function addQuad(left, right, top, bottom, textureName) {
                let prevVertexCount = vertices.length / 3

                vertices = vertices.concat([left[1], top, left[0]])
                vertices = vertices.concat([left[1], bottom, left[0]])
                vertices = vertices.concat([right[1], top, right[0]])
                vertices = vertices.concat([right[1], bottom, right[0]])

                let triangleOffsets = [0, 1, 2, 1, 2, 3]
                for (let triangleOffset of triangleOffsets) {
                    triangles.push(prevVertexCount + triangleOffset)
                }

                let textureBoundary = textures.atlasBoundaryLookup[textureName]
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
                }
            }

            if (sideDef.middleTexture != null) {
                addQuad(startVertex, endVertex, ceilHeight, floorHeight, sideDef.middleTexture.name)
            }

            if (twoSided) {
                console.log(sideDef)
                let otherCeilHeight = otherSector.ceilingHeight
                let otherFloorHeight = otherSector.floorHeight
                if (ceilHeight > otherCeilHeight && sideDef.upperTexture != null) {
                    addQuad(startVertex, endVertex, ceilHeight, otherCeilHeight, sideDef.upperTexture.name)
                }
                if (floorHeight < otherFloorHeight && sideDef.lowerTexture != null) {
                    addQuad(startVertex, endVertex, otherFloorHeight, floorHeight, sideDef.lowerTexture.name)
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
                loadSideDef(rightSideDef, startVertex, endVertex, rightSector, twoSided, leftSector, this.textures)
            }
            if (left) {
                loadSideDef(leftSideDef, endVertex, startVertex, leftSector, twoSided, rightSector, this.textures)
            }
        }

        this.triangleCount = triangles.length

        function fill(buffer, data) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
        }

        let gl = this.webgl

        fill(this.buffers.vertices, vertices)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.triangles)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangles), gl.STATIC_DRAW)

        fill(this.buffers.textureCoords, textureCoords)
        fill(this.buffers.textureBoundaries, textureBoundaries)
        fill(this.buffers.textureTiling, textureTiling)

        this.mapLoaded = true
    }

    render(dt) {
        let gl = this.webgl

        const aspect = this.canvas.clientWidth / this.canvas.clientHeight
        const projectionMatrix = mat4.perspective(this.fov, aspect, this.near, this.far)

        this.camera.rotate(0, 0, 0)

        gl.clearColor(.2, .2, .2, 1)
        gl.clearDepth(1)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        function setupAttrib(attribute, buffer, size) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
            gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 0, 0)
            gl.enableVertexAttribArray(attribute)
        }

        setupAttrib(this.shaders[0].attribute["vertexPosition"], this.buffers.vertices, 3)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.triangles)

        setupAttrib(this.shaders[0].attribute["textureCoord"], this.buffers.textureCoords, 2)
        setupAttrib(this.shaders[0].attribute["textureBoundary"], this.buffers.textureBoundaries, 4)
        setupAttrib(this.shaders[0].attribute["textureTiling"], this.buffers.textureTiling, 2)

        gl.useProgram(this.shaders[0].program)

        gl.uniformMatrix4fv(this.shaders[0].uniform["modelMatrix"], false, mat4.identity)
        gl.uniformMatrix4fv(this.shaders[0].uniform["viewMatrix"], false, this.camera.getMatrix())
        gl.uniformMatrix4fv(this.shaders[0].uniform["projectionMatrix"], false, projectionMatrix)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.textures.atlas)
        gl.uniform1i(this.shaders[0].uniform["sampler"], 0)

        if (this.mapLoaded) {
            gl.drawElements(gl.TRIANGLES, this.triangleCount, gl.UNSIGNED_SHORT, 0)
        }
    }
}

