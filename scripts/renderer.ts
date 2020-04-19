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

function loadTexture(gl) {
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)

    const width = 4
    const height = 4
    const count = 4

    let raw = []
    let black = [0, 0, 0, 255]
    let colors = [[255, 0, 0, 255], [0, 0, 255, 255], [0, 255, 0, 255], [255, 255, 0, 255]]
    for (let y = 0; y < height; y++) {
        for (let i = 0; i < count; i++) {
            for (let x = 0; x < width; x++) {
                let color = black
                let j = width * count * y + width * i + x
                if ((j + Math.floor(j / (width * count))) % 2 == 0) {
                    color = colors[i]
                }
                for (let c = 0; c < 4; c++) {
                    raw.push(color[c])
                }
            }
        }
    }
    const pixels = new Uint8Array(raw)

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width * count, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)

    return texture
}

class Renderer {
    shaders: {program: any, attribute: {}, uniform: {}}[]
    canvas: HTMLCanvasElement
    webgl: WebGLRenderingContext
    buffers
    textures
    camera: Transform
    triangleCount: number

    mapLoaded: boolean = false

    readonly fov = 90 * Math.PI / 180
    readonly near = 0.1
    readonly far = 100000

    constructor(cameraTransform: Transform) {
        this.camera = cameraTransform
    }

    initRenderer() {
        this.canvas = document.querySelector("canvas")
        this.canvas.width = this.canvas.clientWidth
        this.canvas.height = this.canvas.clientHeight

        this.webgl = this.canvas.getContext("webgl")
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

        this.textures = {
            atlas: loadTexture(gl)
        }

        return Promise.all(shaders).then(shaders => {
            this.shaders = shaders
        })
    }

    loadMap(map) {
        let textureCoordLookup = [
            [0  ,0,  0  ,1,  .25,0,  .25,1],
            [.25,0,  .25,1,  .5 ,0,  .5 ,1],
            [.5 ,0,  .5 ,1,  .75,0,  .75,1],
            [.75,0,  .75,1,  1  ,0,  1  ,1]
        ]
        let textureBoundaryLookup = [
            [0  , 0, .25, 1],
            [.25, 0, .25, 1],
            [.5 , 0, .25, 1],
            [.75, 0, .25, 1]
        ]

        let vertices = []
        let triangles = []
        let textureCoords = []
        let textureBoundaries = []
        let textureTiling = []
        let ti = 0

        function loadSideDef(sideDef, startVertex, endVertex, sector, twoSided, otherSector) {
            let floorHeight = sector.floorHeight
            let ceilHeight = sector.ceilingHeight

            function addQuad(left, right, top, bottom) {
                let prevVertexCount = vertices.length / 3

                vertices = vertices.concat([left[0], top, left[1]])
                vertices = vertices.concat([left[0], bottom, left[1]])
                vertices = vertices.concat([right[0], top, right[1]])
                vertices = vertices.concat([right[0], bottom, right[1]])

                let triangleOffsets = [0, 1, 2, 1, 2, 3]
                for (let triangleOffset of triangleOffsets) {
                    triangles.push(prevVertexCount + triangleOffset)
                }

                textureCoords = textureCoords.concat(textureCoordLookup[ti % 4])
                for (let v = 0; v < 4; v++) {
                    textureBoundaries = textureBoundaries.concat(textureBoundaryLookup[ti % 4])
                    textureTiling = textureTiling.concat([2, 1])
                }
                ti++
            }

            if (sideDef.middleTexture != null) {
                addQuad(startVertex, endVertex, ceilHeight, floorHeight)
            }

            if (twoSided) {
                let otherCeilHeight = otherSector.ceilingHeight
                let otherFloorHeight = otherSector.floorHeight
                if (ceilHeight > otherCeilHeight) {
                    addQuad(startVertex, endVertex, ceilHeight, otherCeilHeight)
                }
                if (floorHeight < otherFloorHeight) {
                    addQuad(startVertex, endVertex, otherFloorHeight, floorHeight)
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
                loadSideDef(rightSideDef, startVertex, endVertex, rightSector, twoSided, leftSector)
            }
            if (left) {
                loadSideDef(leftSideDef, endVertex, startVertex, leftSector, twoSided, rightSector)
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

        let x = map.things[0].x
        let y = map.things[0].y
        //this.camera.setTranslation(-x, -41, -y)
        this.camera.setTranslation(-x, -400, -y + 200)

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

