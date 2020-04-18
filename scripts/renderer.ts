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
    let colors = [[255, 0, 0, 255], [0, 0, 255, 255], [0, 255, 0, 255], [0, 255, 0, 255]]
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
    shaders
    canvas
    webgl
    world
    readonly fov = 90 * Math.PI / 180
    readonly near = 0.1
    readonly far = 100
    t = 0

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
            loadShader(gl, "shaders/simple", ["vertexPosition", "textureCoord"],
                ["modelMatrix", "viewMatrix", "projectionMatrix", "sampler"])
        ]

        const vertices = [
            -1,  1, 2,
            -1, -1, 2,
             1,  1, 0,
             1, -1, 0,

             1,  1, 0,
             1, -1, 0,
             3,  1, 1,
             3, -1, 1,

            -1, -1, 2,
             1, -1, 0,
             1, -1, 3,
             3, -1, 1
        ]

        const vertexBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)

        const triangles = [
            0, 1, 2,    1, 2, 3,
            4, 5, 6,    5, 6, 7,
            8, 9,10,    9,10,11
        ]

        const triangleBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangles), gl.STATIC_DRAW)

        const textureCoords = [
            0  , 0,
            0  , 1,
            .25, 0,
            .25, 1,

            .25, 0,
            .25, 1,
            .5 , 0,
            .5 , 1,

            .5 , 0,
            .5 , 1,
            .75, 0,
            .75, 1
        ]

        const textureCoordBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW)

        this.world = {
            buffers: {
                vertices: vertexBuffer,
                triangles: triangleBuffer,
                textureCoords: textureCoordBuffer
            },
            player: new Transform(),
            texture: loadTexture(gl)
        }

        this.world.player.translate(0, 0, -6)

        return Promise.all(shaders).then(shaders => {
            this.shaders = shaders
        })
    }

    render(dt) {
        this.t += dt
        let gl = this.webgl

        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
        const projectionMatrix = mat4.perspective(this.fov, aspect, this.near, this.far)

        gl.clearColor(.2, .2, .2, 1)
        gl.clearDepth(1)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.world.buffers.vertices)
        gl.vertexAttribPointer(this.shaders[0].attribute["vertexPosition"], 3, gl.FLOAT, false, 0, 0)
        gl.enableVertexAttribArray(this.shaders[0].attribute["vertexPosition"])

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.world.buffers.triangles)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.world.buffers.textureCoords)
        gl.vertexAttribPointer(this.shaders[0].attribute["textureCoord"], 2, gl.FLOAT, false, 0, 0)
        gl.enableVertexAttribArray(this.shaders[0].attribute["textureCoord"])

        gl.useProgram(this.shaders[0].program)

        gl.uniformMatrix4fv(this.shaders[0].uniform["modelMatrix"], false, mat4.identity)
        gl.uniformMatrix4fv(this.shaders[0].uniform["viewMatrix"], false, this.world.player.getMatrix())
        gl.uniformMatrix4fv(this.shaders[0].uniform["projectionMatrix"], false, projectionMatrix)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.world.texture)
        gl.uniform1i(this.shaders[0].uniform["sampler"], 0)

        gl.drawElements(gl.TRIANGLES, 18, gl.UNSIGNED_SHORT, 0)
    }
}

