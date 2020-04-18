function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        let infoLog = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('An error occurred compiling the shaders: ' + infoLog);
    }

    return shader;
}

function loadShader(gl, baseName, attributes, uniforms) {
    function location(name, type) {
        switch (type) {
            case gl.VERTEX_SHADER:
                return `${name}.vert`;
            case gl.FRAGMENT_SHADER:
                return `${name}.frag`;
            default:
                throw "unknown type";
        }
    }

    function compile(as) {
        return source => compileShader(gl, as, source);
    }

    let vertex = fetch(location(baseName, gl.VERTEX_SHADER))
        .then(response => response.text())
        .then(compile(gl.VERTEX_SHADER));

    let fragment = fetch(location(baseName, gl.FRAGMENT_SHADER))
        .then(response => response.text())
        .then(compile(gl.FRAGMENT_SHADER));

    return Promise.all([vertex, fragment]).then(([vertexShader, fragmentShader]) => {
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            let infoLog = gl.getProgramInfoLog(shaderProgram);
            gl.deleteProgram(shaderProgram);
            throw new Error('Unable to initialize the shader program: ' + infoLog);
        }

        let shader = {
            program: shaderProgram,
            attribute: {},
            uniform: {},
        };

        for (let attribute of attributes) {
            shader.attribute[attribute] = gl.getAttribLocation(shaderProgram, attribute);
        }

        for (let uniform of uniforms) {
            shader.uniform[uniform] = gl.getUniformLocation(shaderProgram, uniform);
        }

        return shader;
    });
}

function loadTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
}

class Renderer {
    initRenderer() {
        this.canvas = document.querySelector("canvas");
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        this.webgl = this.canvas.getContext("webgl");
        let gl = this.webgl;

        if (gl == null) {
            alert("Unable to initialize WebGL!");
            return;
        }

        // gl.enable(gl.DEPTH_TEST)
        // gl.depthFunc(gl.LEQUAL)

        let shaders = [
            loadShader(gl, "shaders/simple", ["vertexPosition", "vertexColor"],
                ["modelMatrix", "viewMatrix", "projectionMatrix"])
        ];

        const vertices = [
            -1,  1,
             1,  1,
            -1, -1,
             1, -1
        ]

        const vertexBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)

        const colors = [
            1, 1, 1, 1, // white
            1, 0, 0, 1, // red
            0, 1, 0, 1, // green
            0, 0, 1, 1  // blue
        ];

        const colorBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW)

        this.map = {
            vertices: vertices,
            buffers: {
                vertices: vertexBuffer,
                colors: colorBuffer
            },
            rectangle: new Transform(),
            player: new Transform()
        }

        this.map.player.translate(0, 0, -6)

        return Promise.all(shaders).then(shaders => {
            this.shaders = shaders;
        })
    }

    shaders
    canvas
    webgl
    map

    readonly fov = 90 * Math.PI / 180
    readonly near = 0.1;
    readonly far = 100;

    t = 0;

    render(dt) {
        this.t += dt;
        let gl = this.webgl

        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
        const projectionMatrix = mat4.perspective(this.fov, aspect, this.near, this.far)

        this.map.rectangle.rotate(0, deg2rad(1), 0)

        gl.clearColor(.2, .2, .2, 1)
        // gl.clearDepth(1)
        // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.map.buffers.vertices);
        gl.vertexAttribPointer(this.shaders[0].attribute["vertexPosition"], 2, gl.FLOAT, false, 0, 0)
        gl.enableVertexAttribArray(this.shaders[0].attribute["vertexPosition"])

        gl.bindBuffer(gl.ARRAY_BUFFER, this.map.buffers.colors);
        gl.vertexAttribPointer(this.shaders[0].attribute["vertexColor"], 4, gl.FLOAT, false, 0, 0)
        gl.enableVertexAttribArray(this.shaders[0].attribute["vertexColor"])

        gl.useProgram(this.shaders[0].program)

        gl.uniformMatrix4fv(this.shaders[0].uniform["modelMatrix"], false, this.map.rectangle.getMatrix())
        gl.uniformMatrix4fv(this.shaders[0].uniform["viewMatrix"], false, this.map.player.getMatrix())
        gl.uniformMatrix4fv(this.shaders[0].uniform["projectionMatrix"], false, projectionMatrix)

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
}

