#version 300 es

in highp vec2 texCoord;
in highp float lightLvl;
in highp float camDistance;

uniform highp usampler2D atlasSampler;
uniform highp usampler2D colorMapsSampler;
uniform highp usampler2D palettesSampler;

out highp vec4 fragColor;

void main() {
    highp float distanceFactor = 1.0 - (camDistance / 1000.0);

    highp uint color = texture(atlasSampler, vec2(texCoord.x, texCoord.y)).x;
    highp uint mappedColor = texelFetch(colorMapsSampler, ivec2(color, lightLvl), 0).x;
    highp uvec4 paletteColor = texelFetch(palettesSampler, ivec2(mappedColor, 0), 0);
    fragColor = vec4(float(paletteColor.x) / 256.0 * distanceFactor, float(paletteColor.y) / 256.0 * distanceFactor, float(paletteColor.z) / 256.0 * distanceFactor, 1);
}
