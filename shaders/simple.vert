attribute vec4 vertexPosition;
attribute vec2 textureCoord;
attribute vec4 textureBoundary;
attribute vec2 textureTiling;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

varying highp vec2 texCoord;
varying highp vec4 texBoundary;
varying highp vec2 texTiling;

void main() {
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vertexPosition;
    texCoord = textureCoord;
    texBoundary = textureBoundary;
    texTiling = textureTiling;
}