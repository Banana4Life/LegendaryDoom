#version 300 es

in vec4 vertexPosition;
in vec2 textureCoord;
in vec4 textureBoundary;
in vec2 textureTiling;
in float lightLevel;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

out highp vec2 texCoord;
out highp vec4 texBoundary;
out highp vec2 texTiling;
out highp float lightLvl;

void main() {
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vertexPosition;
    texCoord = textureCoord;
    texBoundary = textureBoundary;
    texTiling = textureTiling;
    lightLvl = lightLevel;
}