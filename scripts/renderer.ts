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

function initRenderer(callback) {
    let canvas = document.querySelector("canvas");
    let gl = canvas.getContext("webgl");

    if (gl == null) {
        alert("Unable to initialize WebGL!");
        return;
    }

    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)

    let shaders = [
        loadShader(gl, "shaders/simple", ["vertexPosition"], ["projectionMatrix", "modelViewMatrix"])
    ];

    const vertices = [-1, 1, 1, 1, -1, -1, 1, -1]

    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)

    const map = {
        vertices: vertices,
        buffers: {
            vertices: vertexBuffer
        }
    }

    Promise.all(shaders).then(loadedShaders => {
        callback(canvas, gl, loadedShaders, map);
    }, err => {
        console.error("Error!", err)
    });
}

const fov = 45 * Math.PI / 180
const near = 0.1;
const far = 100;
const modelViewMatrix = mat4.translate(0, 0, -6)

function render(gl, shaders, map) {
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
    const projectionMatrix = mat4.perspective(fov, aspect, near, far)

    window.requestAnimationFrame(t => {
        gl.clearColor((t % 1000) / 1000, 0, 0, 1)
        gl.clearDepth(1)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        gl.bindBuffer(gl.ARRAY_BUFFER, map.buffers.vertices);
        gl.vertexAttribPointer(shaders[0].attribute["vertexPosition"], 2, gl.FLOAT, false, 0, 0)
        gl.enableVertexAttribArray(shaders[0].attribute["vertexPosition"])

        gl.useProgram(shaders[0].program)

        gl.uniformMatrix4fv(shaders[0].uniform["projectionMatrix"], false, projectionMatrix)
        gl.uniformMatrix4fv(shaders[0].uniform["modelViewMatrix"], false, modelViewMatrix)

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        render(gl, shaders, map)
    })
}