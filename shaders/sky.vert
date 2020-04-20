#version 300 es

in vec4 vertexPosition;
in vec2 textureCoord;

out highp vec2 texCoord;

void main() {
    gl_Position = vertexPosition;
    texCoord = textureCoord;
}