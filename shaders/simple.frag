#version 300 es

in highp vec2 texCoord;
in highp float lightLvl;
in highp float camDistance;

uniform highp usampler2D atlasSampler;
uniform highp usampler2D colorMapsSampler;
uniform highp usampler2D palettesSampler;
uniform highp int colorPalette;

out highp vec4 fragColor;

const highp float DistanceScale = 1.0 / 400.0; // depends on frustum depth
const highp int MaxLightDistance = 4;
const highp float LightLevelSteps = 16.0;

void main() {
    highp int distanceOffset = int(floor(camDistance * DistanceScale * LightLevelSteps));
    highp int distanceAdjustedLightLevel = min(31, int(lightLvl) + max(0, distanceOffset - MaxLightDistance));

    highp uint color = texture(atlasSampler, vec2(texCoord.x, texCoord.y)).x;
    highp uint mappedColor = texelFetch(colorMapsSampler, ivec2(color, distanceAdjustedLightLevel), 0).x;
    highp uvec4 paletteColor = texelFetch(palettesSampler, ivec2(mappedColor, 0), 0);
    //fragColor = vec4(camDistance / 250.0, float(paletteColor.y) / 256.0, float(paletteColor.z) / 256.0, 1);
    fragColor = vec4(float(paletteColor.x) / 256.0, float(paletteColor.y) / 256.0, float(paletteColor.z) / 256.0, 1);
}
