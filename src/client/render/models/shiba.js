// 시바 코드 모델 (자동 생성 — 직접 고치지 말 것)
// 원본: art/models/shiba (img2threejs 스킬, 참고 이미지 assets/source/shiba.png).
// 다시 만들기: art/models/shiba/rebuild.sh → export_game.sh. 등록: src/config/models.js 의 procedural.
// ../../../../../../home/user/ink-escape/art/models/shiba/work/src/createObjectModel.ts
import * as THREE from "three";
function buildWatertightCapsule(radius, cylLength, capSegments, radialSegments, heightSegments) {
  const positions = [];
  const indices = [];
  const uvs = [];
  const halfCyl = cylLength / 2;
  const totalSpan = 2 * (Math.PI / 2 * radius) + Math.max(0, cylLength);
  const vOf = (fromBottom) => totalSpan > 0 ? fromBottom / totalSpan : 0;
  const bottomPoleIndex = positions.length / 3;
  positions.push(0, -halfCyl - radius, 0);
  uvs.push(0.5, vOf(0));
  const ringStarts = [];
  const ringV = [];
  for (let ring = 1; ring <= capSegments; ring += 1) {
    const phi = Math.PI / 2 * (ring / capSegments);
    const y = -halfCyl - radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    ringStarts.push(start);
    ringV.push(vOf(radius * phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = radial / radialSegments * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, vOf(radius * phi));
    }
  }
  const cylinderRingStarts = [];
  if (cylLength > 0) {
    for (let step = 1; step <= heightSegments; step += 1) {
      const y = -halfCyl + cylLength * step / heightSegments;
      const start = positions.length / 3;
      cylinderRingStarts.push(start);
      const v = vOf(radius * (Math.PI / 2) + halfCyl + y);
      for (let radial = 0; radial < radialSegments; radial += 1) {
        const theta = radial / radialSegments * Math.PI * 2;
        positions.push(radius * Math.cos(theta), y, radius * Math.sin(theta));
        uvs.push(radial / radialSegments, v);
      }
    }
  }
  const topRingStarts = [];
  for (let ring = capSegments - 1; ring >= 1; ring -= 1) {
    const phi = Math.PI / 2 * (ring / capSegments);
    const y = halfCyl + radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    topRingStarts.push(start);
    const v = vOf(radius * (Math.PI / 2) + Math.max(0, cylLength) + radius * (Math.PI / 2 - phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = radial / radialSegments * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, v);
    }
  }
  const topPoleIndex = positions.length / 3;
  positions.push(0, halfCyl + radius, 0);
  uvs.push(0.5, vOf(totalSpan));
  const firstBottomRing = ringStarts[0];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(bottomPoleIndex, firstBottomRing + radial, firstBottomRing + next);
  }
  const allRings = [...ringStarts, ...cylinderRingStarts, ...topRingStarts];
  for (let i = 0; i < allRings.length - 1; i += 1) {
    const a = allRings[i];
    const b = allRings[i + 1];
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const next = (radial + 1) % radialSegments;
      indices.push(a + radial, a + next, b + next);
      indices.push(a + radial, b + next, b + radial);
    }
  }
  const lastRing = allRings[allRings.length - 1];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(topPoleIndex, lastRing + next, lastRing + radial);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function buildExtrudeShape(points, holes) {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}
function ovalLoop(cx, cy, rx, ry, seg = 24) {
  const loop = [];
  for (let i = 0; i < seg; i += 1) {
    const a = i / seg * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}
function buildExtrudeGeometry(profile) {
  const holes = [...profile.holes ?? [], ...(profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1
  });
}
function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function readLayerNumber(value, keys, fallback) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const record = value;
    for (const key of keys) {
      if (typeof record[key] === "number") return record[key];
    }
  }
  return fallback;
}
function hexToRgb(hex) {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex) ? "#" + hex.slice(1).split("").map((part) => part + part).join("") : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 9075295;
  return [clampAlbedoChannel(value >> 16 & 255), clampAlbedoChannel(value >> 8 & 255), clampAlbedoChannel(value & 255)];
}
function materialPalette(spec) {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === "string");
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...Array.isArray(secondary) ? secondary : []];
  return colors.filter((value) => typeof value === "string" && value.startsWith("#"));
}
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function clampAlbedoChannel(value) {
  return Math.max(30, Math.min(240, Math.round(value)));
}
function clampPbrF0(value) {
  return Math.max(0.02, Math.min(1, value));
}
function clampPbrIor(value) {
  return Math.max(1, Math.min(2.5, value));
}
function clampPbrMetalness(value) {
  return value >= 0.5 ? 1 : 0;
}
function clampedAlbedoColor(spec) {
  const source = typeof spec.baseColor === "string" ? spec.baseColor : "#8A7A5F";
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}
function smoothCurve(value) {
  return value * value * (3 - 2 * value);
}
function periodicHash(x, y, seed, periodX, periodY) {
  const wrappedX = (x % periodX + periodX) % periodX;
  const wrappedY = (y % periodY + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ value >>> 13, 1274126177);
  return ((value ^ value >>> 16) >>> 0) / 4294967295;
}
function periodicValueNoise(u, v, seed, periodX, periodY) {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}
function surfaceBands(spec) {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const band = item;
    const frequency = typeof band.frequency === "number" ? band.frequency : 0;
    const amplitude = typeof band.amplitude === "number" ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? "")} ${String(band.role ?? "")}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === "number" ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === "number" ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description)
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false }
  ];
}
function sampleSurface(u, v, bands, seed) {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}
function mixPalette(colors, value) {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix))
  ];
}
function parseRgba(value) {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}
function sampleColorGradient(gradient, u, v) {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: "rgba(138,122,95,1)" }, { offset: 1, color: "rgba(138,122,95,1)" }];
  let t;
  if (gradient.type === "radial") {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(1e-3, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix)
  ];
}
function writePixel(data, offset, red, green, blue) {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}
function makeCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}
function createMapTexture(canvas, colorSpace, spec, options) {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === "object" ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === "number" ? repeat[0] : 2,
    typeof repeat[1] === "number" ? repeat[1] : 2
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}
function referenceMapUrl(spec, channel) {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== "object") return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === "number" ? reference.confidence : typeof reference.estimatedFidelity === "number" ? reference.estimatedFidelity : 0;
  const threshold = typeof reference.targetThreshold === "number" ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== "object") return null;
  const map = maps[channel];
  if (!map || typeof map !== "object") return null;
  const record = map;
  const url = typeof record.url === "string" && record.url.trim() ? record.url : record.path;
  return typeof url === "string" && url.trim() ? url : null;
}
function createLoadedMapTexture(url, colorSpace, spec, options) {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === "object" ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === "number" ? repeat[0] : 1,
    typeof repeat[1] === "number" ? repeat[1] : 1
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}
function makeReferenceTextureSet(spec, options) {
  const albedo = referenceMapUrl(spec, "albedo");
  const roughness = referenceMapUrl(spec, "roughness");
  const height = referenceMapUrl(spec, "height");
  const normal = referenceMapUrl(spec, "normal");
  const ao = referenceMapUrl(spec, "ao");
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: "reference-pixel-extraction"
  };
}
function makeProceduralTextureSet(id, spec, options) {
  if (typeof document === "undefined") return null;
  const qualityFirst = (options.qualityPriority ?? "reference-fidelity") === "reference-fidelity";
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === "number" && Number.isFinite(requested) ? requested : qualityFirst ? 1024 : 512;
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size)
  };
  const contexts = {
    albedo: canvases.albedo.getContext("2d"),
    roughness: canvases.roughness.getContext("2d"),
    height: canvases.height.getContext("2d"),
    normal: canvases.normal.getContext("2d"),
    ao: canvases.ao.getContext("2d")
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size)
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === "string" ? spec.baseColor : "#8A7A5F";
  const colors = (palette.length >= 2 ? palette : [fallback, "#6E614B", "#A08F70"]).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ["base"], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ["variation"], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ["amplitude", "variation"], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ["heightCorrelation"], 0.3));
  const colorGradient = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color;
      if (colorGradient) {
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ["strength", "amplitude"], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ["cavityStrength", "strength"], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = (y - 1 + size) % size * size;
    const down = (y + 1) % size * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (heightField[y * size + left] + heightField[y * size + right] + heightField[up + x] + heightField[down + x]) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data,
        offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: "procedural"
  };
}
function createSculptMaterial(id, spec, options, denseComponent = false) {
  const textureless = spec.textureless?.declared === true;
  const textures = textureless ? null : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 16777215 : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ["base"], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ["base"], 0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ["base", "amount"], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ["base"], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ["base", "amount"], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ["base", "value"], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ["base", "amount"], 0)),
    attenuationDistance: Math.max(1e-3, readLayerNumber(spec.attenuationDistance, ["base", "value"], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === "string" ? spec.attenuationColor : "#ffffff"),
    sheen: clamp01(readLayerNumber(spec.sheen, ["base", "amount"], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === "string" ? spec.sheenColor : "#ffffff"),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ["base"], 1)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ["base", "amount"], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ["base", "value"], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ["base", "amount"], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ["rotation"], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ["base", "value"], 1)),
    specularColor: new THREE.Color(typeof spec.specularColor === "string" ? spec.specularColor : "#ffffff"),
    emissive: new THREE.Color(typeof spec.emissive === "string" ? spec.emissive : "#000000"),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ["base"], 1)),
    opacity: clamp01(readLayerNumber(spec.opacity, ["base"], 1)),
    transparent: readLayerNumber(spec.transmission, ["base", "amount"], 0) > 0 || readLayerNumber(spec.opacity, ["base"], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ["cutoff", "alphaTest"], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ["strength", "amplitude"], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ["cavityStrength", "strength"], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === "dense" || spec.topologyClass === "dense";
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ["amplitude", "strength"], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ["amplitude", "strength"], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(5e-3, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ["envMapIntensity"], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? "flat-fallback";
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}
function readVector3(value, fallback) {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "number")) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}
function readNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function makeAttachmentEndpoint(attachment) {
  if (!attachment || typeof attachment !== "object") return null;
  const record = attachment;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 1e-4) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(5e-3, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(3e-3, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius
  };
}
function createChibiShibaMascotModel(options = {}) {
  const root = new THREE.Group();
  root.name = "Chibi Shiba Mascot";
  const materialMap = {};
  materialMap["hidden"] = createSculptMaterial(
    "hidden",
    { "id": "hidden", "name": "Base material", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#000000", "color": "#000000", "albedo": { "dominant": "#000000", "secondary": ["#000000"] }, "colorVariation": { "palette": ["#000000", "#000000"], "pattern": "flat", "amplitude": 0.05, "heightCorrelation": 0 }, "roughness": { "base": 1, "variation": 0 }, "metalness": { "base": 0, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "opacity": { "base": 0 }, "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region n/a (not separately cropped: too small or hidden)"] } },
    options
  );
  materialMap["fur-orange"] = createSculptMaterial(
    "fur-orange",
    { "id": "fur-orange", "name": "Orange fur", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#d27a22", "color": "#d27a22", "albedo": { "dominant": "#d27a22", "secondary": [] }, "colorVariation": { "palette": ["#d27a22"], "pattern": "flat", "amplitude": 0, "heightCorrelation": 0 }, "roughness": { "base": 0.92, "variation": 0.03 }, "metalness": { "base": 0, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [{ "id": "forehead-lighter", "kind": "colour-zone", "mask": "component-region", "notes": "Slightly lighter orange on crown." }], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region forehead-fur"] } },
    options
  );
  materialMap["fur-cream"] = createSculptMaterial(
    "fur-cream",
    { "id": "fur-cream", "name": "Cream fur", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#f2e6cf", "color": "#f2e6cf", "albedo": { "dominant": "#f2e6cf", "secondary": [] }, "colorVariation": { "palette": ["#f2e6cf"], "pattern": "flat", "amplitude": 0, "heightCorrelation": 0 }, "roughness": { "base": 0.92, "variation": 0.03 }, "metalness": { "base": 0, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [{ "id": "urajiro-boundary", "kind": "colour-zone", "mask": "component-region", "notes": "Hard boundary between orange top and cream lower face/belly (shiba urajiro)." }], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region belly-fur"] } },
    options
  );
  materialMap["ear-inner"] = createSculptMaterial(
    "ear-inner",
    { "id": "ear-inner", "name": "Ear inner", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#f0d9c4", "color": "#f0d9c4", "albedo": { "dominant": "#f0d9c4", "secondary": [] }, "colorVariation": { "palette": ["#f0d9c4"], "pattern": "flat", "amplitude": 0, "heightCorrelation": 0 }, "roughness": { "base": 0.9, "variation": 0.03 }, "metalness": { "base": 0, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region ear-inner"] } },
    options
  );
  materialMap["eye"] = createSculptMaterial(
    "eye",
    { "id": "eye", "name": "Glossy eye", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#141012", "color": "#141012", "albedo": { "dominant": "#141012", "secondary": [] }, "colorVariation": { "palette": ["#141012"], "pattern": "flat", "amplitude": 0, "heightCorrelation": 0 }, "roughness": { "base": 0.15, "variation": 0.03 }, "metalness": { "base": 0, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region eye"] } },
    options
  );
  materialMap["catchlight"] = createSculptMaterial(
    "catchlight",
    { "id": "catchlight", "name": "Eye catchlight", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#ffffff", "color": "#ffffff", "albedo": { "dominant": "#ffffff", "secondary": [] }, "colorVariation": { "palette": ["#ffffff"], "pattern": "flat", "amplitude": 0, "heightCorrelation": 0 }, "roughness": { "base": 0.3, "variation": 0.03 }, "metalness": { "base": 0, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region n/a (not separately cropped: too small or hidden)"] } },
    options
  );
  materialMap["nose"] = createSculptMaterial(
    "nose",
    { "id": "nose", "name": "Nose", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#3a2620", "color": "#3a2620", "albedo": { "dominant": "#3a2620", "secondary": [] }, "colorVariation": { "palette": ["#3a2620"], "pattern": "flat", "amplitude": 0, "heightCorrelation": 0 }, "roughness": { "base": 0.4, "variation": 0.03 }, "metalness": { "base": 0, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region nose"] } },
    options
  );
  materialMap["mouth"] = createSculptMaterial(
    "mouth",
    { "id": "mouth", "name": "Mouth interior", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#5a2a22", "color": "#5a2a22", "albedo": { "dominant": "#5a2a22", "secondary": [] }, "colorVariation": { "palette": ["#5a2a22"], "pattern": "flat", "amplitude": 0, "heightCorrelation": 0 }, "roughness": { "base": 0.6, "variation": 0.03 }, "metalness": { "base": 0, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region n/a (not separately cropped: too small or hidden)"] } },
    options
  );
  materialMap["tongue"] = createSculptMaterial(
    "tongue",
    { "id": "tongue", "name": "Tongue", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#e5818a", "color": "#e5818a", "albedo": { "dominant": "#e5818a", "secondary": [] }, "colorVariation": { "palette": ["#e5818a"], "pattern": "flat", "amplitude": 0, "heightCorrelation": 0 }, "roughness": { "base": 0.45, "variation": 0.03 }, "metalness": { "base": 0, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region tongue"] } },
    options
  );
  materialMap["bandana"] = createSculptMaterial(
    "bandana",
    { "id": "bandana", "name": "Bandana cotton", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#e2601e", "color": "#e2601e", "albedo": { "dominant": "#e2601e", "secondary": [] }, "colorVariation": { "palette": ["#e2601e"], "pattern": "flat", "amplitude": 0, "heightCorrelation": 0 }, "roughness": { "base": 0.88, "variation": 0.03 }, "metalness": { "base": 0, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region bandana"] } },
    options
  );
  materialMap["leather"] = createSculptMaterial(
    "leather",
    { "id": "leather", "name": "Brown leather", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#7a4f33", "color": "#7a4f33", "albedo": { "dominant": "#7a4f33", "secondary": [] }, "colorVariation": { "palette": ["#7a4f33"], "pattern": "flat", "amplitude": 0, "heightCorrelation": 0 }, "roughness": { "base": 0.6, "variation": 0.03 }, "metalness": { "base": 0, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [{ "id": "edge-wear", "kind": "wear", "mask": "component-region", "notes": "Lighter worn edges on belt and pouch rims." }], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region belt-strap"] } },
    options
  );
  materialMap["leather-dark"] = createSculptMaterial(
    "leather-dark",
    { "id": "leather-dark", "name": "Dark leather", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#6b4430", "color": "#6b4430", "albedo": { "dominant": "#6b4430", "secondary": [] }, "colorVariation": { "palette": ["#6b4430"], "pattern": "flat", "amplitude": 0, "heightCorrelation": 0 }, "roughness": { "base": 0.62, "variation": 0.03 }, "metalness": { "base": 0, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region pouch-flap"] } },
    options
  );
  materialMap["brass"] = createSculptMaterial(
    "brass",
    { "id": "brass", "name": "Brass", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#b08a4a", "color": "#b08a4a", "albedo": { "dominant": "#b08a4a", "secondary": [] }, "colorVariation": { "palette": ["#b08a4a"], "pattern": "flat", "amplitude": 0, "heightCorrelation": 0 }, "roughness": { "base": 0.35, "variation": 0.03 }, "metalness": { "base": 0.8, "variation": 0 }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Soft contact darkening where parts meet (head/torso, belt/torso, limbs)." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [{ "id": "buckle-shine", "kind": "gloss", "mask": "component-region", "notes": "Brighter specular on buckle face." }], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": { "declared": true, "evidence": ["reference.png: flat-shaded designer-toy render; regions are flat colour with hard boundaries, no print/grain/pores at 590px", "material-analysis.json region buckle-brass"] } },
    options
  );
  const nodes = { root };
  const meshes = {};
  const sockets = {};
  const colliders = {};
  const destructionGroups = {};
  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Shiba (root)__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
  } else {
    node_root_0.position.set(0, 0, 0);
    node_root_0.rotation.set(0, 0, 0);
  }
  node_root_0.userData.actionProfile = { "animationRole": "root", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0 ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12) : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(1, 1, 1);
  }
  const mesh_root_0 = new THREE.SkinnedMesh(
    mesh_root_0Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_root_0.name = "Shiba (root)";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_root_0);
  const endpoint_torso_1 = makeAttachmentEndpoint(null);
  const node_torso_1 = new THREE.Group();
  node_torso_1.name = "Torso__pivot";
  node_torso_1.scale.set(1, 1, 1);
  if (endpoint_torso_1) {
    node_torso_1.position.copy(endpoint_torso_1.start);
    node_torso_1.rotation.set(0, 0, 0);
  } else {
    node_torso_1.position.set(0, 0.315, 0);
    node_torso_1.rotation.set(0, 0, 0);
  }
  node_torso_1.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["root"] ?? root).add(node_torso_1);
  nodes["torso"] = node_torso_1;
  const mesh_torso_1Geometry = endpoint_torso_1 ? new THREE.CylinderGeometry(endpoint_torso_1.endRadius, endpoint_torso_1.baseRadius, endpoint_torso_1.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_torso_1) {
    mesh_torso_1Geometry.scale(0.63, 0.53, 0.5);
  }
  const mesh_torso_1 = new THREE.SkinnedMesh(
    mesh_torso_1Geometry,
    materialMap["fur-orange"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_torso_1.name = "Torso";
  if (endpoint_torso_1) {
    mesh_torso_1.position.copy(endpoint_torso_1.midpoint);
    mesh_torso_1.quaternion.copy(endpoint_torso_1.quaternion);
  }
  mesh_torso_1.castShadow = options.castShadow ?? true;
  mesh_torso_1.receiveShadow = options.receiveShadow ?? true;
  node_torso_1.add(mesh_torso_1);
  meshes["torso"] = mesh_torso_1;
  colliders["torso"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_torso_1);
  const endpoint_belly_2 = makeAttachmentEndpoint(null);
  const node_belly_2 = new THREE.Group();
  node_belly_2.name = "Belly patch__pivot";
  node_belly_2.scale.set(1, 1, 1);
  if (endpoint_belly_2) {
    node_belly_2.position.copy(endpoint_belly_2.start);
    node_belly_2.rotation.set(0, 0, 0);
  } else {
    node_belly_2.position.set(0, -0.02, 0.1);
    node_belly_2.rotation.set(0, 0, 0);
  }
  node_belly_2.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_belly_2);
  nodes["belly"] = node_belly_2;
  const mesh_belly_2Geometry = endpoint_belly_2 ? new THREE.CylinderGeometry(endpoint_belly_2.endRadius, endpoint_belly_2.baseRadius, endpoint_belly_2.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_belly_2) {
    mesh_belly_2Geometry.scale(0.44, 0.4, 0.34);
  }
  const mesh_belly_2 = new THREE.Mesh(
    mesh_belly_2Geometry,
    materialMap["fur-cream"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_belly_2.name = "Belly patch";
  if (endpoint_belly_2) {
    mesh_belly_2.position.copy(endpoint_belly_2.midpoint);
    mesh_belly_2.quaternion.copy(endpoint_belly_2.quaternion);
  }
  mesh_belly_2.castShadow = options.castShadow ?? true;
  mesh_belly_2.receiveShadow = options.receiveShadow ?? true;
  node_belly_2.add(mesh_belly_2);
  meshes["belly"] = mesh_belly_2;
  colliders["belly"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_belly_2);
  const endpoint_head_3 = makeAttachmentEndpoint(null);
  const node_head_3 = new THREE.Group();
  node_head_3.name = "Head__pivot";
  node_head_3.scale.set(1, 1, 1);
  if (endpoint_head_3) {
    node_head_3.position.copy(endpoint_head_3.start);
    node_head_3.rotation.set(0, 0, 0);
  } else {
    node_head_3.position.set(0, 0.41, 0.02);
    node_head_3.rotation.set(0, 0, 0);
  }
  node_head_3.userData.actionProfile = { "animationRole": "rotate", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_head_3);
  nodes["head"] = node_head_3;
  const mesh_head_3Geometry = endpoint_head_3 ? new THREE.CylinderGeometry(endpoint_head_3.endRadius, endpoint_head_3.baseRadius, endpoint_head_3.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_head_3) {
    mesh_head_3Geometry.scale(0.53, 0.38, 0.47);
  }
  const mesh_head_3 = new THREE.SkinnedMesh(
    mesh_head_3Geometry,
    materialMap["fur-orange"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_head_3.name = "Head";
  if (endpoint_head_3) {
    mesh_head_3.position.copy(endpoint_head_3.midpoint);
    mesh_head_3.quaternion.copy(endpoint_head_3.quaternion);
  }
  mesh_head_3.castShadow = options.castShadow ?? true;
  mesh_head_3.receiveShadow = options.receiveShadow ?? true;
  node_head_3.add(mesh_head_3);
  meshes["head"] = mesh_head_3;
  colliders["head"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_head_3);
  const endpoint_face_mask_4 = makeAttachmentEndpoint(null);
  const node_face_mask_4 = new THREE.Group();
  node_face_mask_4.name = "Face mask (urajiro)__pivot";
  node_face_mask_4.scale.set(1, 1, 1);
  if (endpoint_face_mask_4) {
    node_face_mask_4.position.copy(endpoint_face_mask_4.start);
    node_face_mask_4.rotation.set(0, 0, 0);
  } else {
    node_face_mask_4.position.set(0, -0.08, 0.075);
    node_face_mask_4.rotation.set(0, 0, 0);
  }
  node_face_mask_4.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["head"] ?? root).add(node_face_mask_4);
  nodes["face-mask"] = node_face_mask_4;
  const mesh_face_mask_4Geometry = endpoint_face_mask_4 ? new THREE.CylinderGeometry(endpoint_face_mask_4.endRadius, endpoint_face_mask_4.baseRadius, endpoint_face_mask_4.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_face_mask_4) {
    mesh_face_mask_4Geometry.scale(0.56, 0.255, 0.35);
  }
  const mesh_face_mask_4 = new THREE.Mesh(
    mesh_face_mask_4Geometry,
    materialMap["fur-cream"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_face_mask_4.name = "Face mask (urajiro)";
  if (endpoint_face_mask_4) {
    mesh_face_mask_4.position.copy(endpoint_face_mask_4.midpoint);
    mesh_face_mask_4.quaternion.copy(endpoint_face_mask_4.quaternion);
  }
  mesh_face_mask_4.castShadow = options.castShadow ?? true;
  mesh_face_mask_4.receiveShadow = options.receiveShadow ?? true;
  node_face_mask_4.add(mesh_face_mask_4);
  meshes["face-mask"] = mesh_face_mask_4;
  colliders["face-mask"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_face_mask_4);
  const endpoint_muzzle_5 = makeAttachmentEndpoint(null);
  const node_muzzle_5 = new THREE.Group();
  node_muzzle_5.name = "Muzzle__pivot";
  node_muzzle_5.scale.set(1, 1, 1);
  if (endpoint_muzzle_5) {
    node_muzzle_5.position.copy(endpoint_muzzle_5.start);
    node_muzzle_5.rotation.set(0, 0, 0);
  } else {
    node_muzzle_5.position.set(0, -0.055, 0.17);
    node_muzzle_5.rotation.set(0, 0, 0);
  }
  node_muzzle_5.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["head"] ?? root).add(node_muzzle_5);
  nodes["muzzle"] = node_muzzle_5;
  const mesh_muzzle_5Geometry = endpoint_muzzle_5 ? new THREE.CylinderGeometry(endpoint_muzzle_5.endRadius, endpoint_muzzle_5.baseRadius, endpoint_muzzle_5.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_muzzle_5) {
    mesh_muzzle_5Geometry.scale(0.17, 0.11, 0.12);
  }
  const mesh_muzzle_5 = new THREE.Mesh(
    mesh_muzzle_5Geometry,
    materialMap["fur-cream"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_muzzle_5.name = "Muzzle";
  if (endpoint_muzzle_5) {
    mesh_muzzle_5.position.copy(endpoint_muzzle_5.midpoint);
    mesh_muzzle_5.quaternion.copy(endpoint_muzzle_5.quaternion);
  }
  mesh_muzzle_5.castShadow = options.castShadow ?? true;
  mesh_muzzle_5.receiveShadow = options.receiveShadow ?? true;
  node_muzzle_5.add(mesh_muzzle_5);
  meshes["muzzle"] = mesh_muzzle_5;
  colliders["muzzle"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_muzzle_5);
  const endpoint_ear_l_6 = makeAttachmentEndpoint(null);
  const node_ear_l_6 = new THREE.Group();
  node_ear_l_6.name = "Ear L__pivot";
  node_ear_l_6.scale.set(1, 1, 1);
  if (endpoint_ear_l_6) {
    node_ear_l_6.position.copy(endpoint_ear_l_6.start);
    node_ear_l_6.rotation.set(-0.13963, 0, -0.24435);
  } else {
    node_ear_l_6.position.set(0.145, 0.115, -0.03);
    node_ear_l_6.rotation.set(-0.13963, 0, -0.24435);
  }
  node_ear_l_6.userData.actionProfile = { "animationRole": "rotate", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["head"] ?? root).add(node_ear_l_6);
  nodes["ear-l"] = node_ear_l_6;
  const mesh_ear_l_6Geometry = endpoint_ear_l_6 ? new THREE.CylinderGeometry(endpoint_ear_l_6.endRadius, endpoint_ear_l_6.baseRadius, endpoint_ear_l_6.length, 32, 12) : buildExtrudeGeometry({ "points": [[-0.072, 0], [0.072, 0], [0.03, 0.09], [8e-3, 0.135], [-8e-3, 0.135], [-0.03, 0.09]], "depth": 0.05 });
  if (!endpoint_ear_l_6) {
    mesh_ear_l_6Geometry.scale(1, 1, 1);
  }
  const mesh_ear_l_6 = new THREE.SkinnedMesh(
    mesh_ear_l_6Geometry,
    materialMap["fur-orange"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_ear_l_6.name = "Ear L";
  if (endpoint_ear_l_6) {
    mesh_ear_l_6.position.copy(endpoint_ear_l_6.midpoint);
    mesh_ear_l_6.quaternion.copy(endpoint_ear_l_6.quaternion);
  }
  mesh_ear_l_6.castShadow = options.castShadow ?? true;
  mesh_ear_l_6.receiveShadow = options.receiveShadow ?? true;
  node_ear_l_6.add(mesh_ear_l_6);
  meshes["ear-l"] = mesh_ear_l_6;
  colliders["ear-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_ear_l_6);
  const endpoint_ear_inner_l_7 = makeAttachmentEndpoint(null);
  const node_ear_inner_l_7 = new THREE.Group();
  node_ear_inner_l_7.name = "Ear inner L__pivot";
  node_ear_inner_l_7.scale.set(1, 1, 1);
  if (endpoint_ear_inner_l_7) {
    node_ear_inner_l_7.position.copy(endpoint_ear_inner_l_7.start);
    node_ear_inner_l_7.rotation.set(0, 0, 0);
  } else {
    node_ear_inner_l_7.position.set(0, 0.012, 0.051);
    node_ear_inner_l_7.rotation.set(0, 0, 0);
  }
  node_ear_inner_l_7.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["ear-l"] ?? root).add(node_ear_inner_l_7);
  nodes["ear-inner-l"] = node_ear_inner_l_7;
  const mesh_ear_inner_l_7Geometry = endpoint_ear_inner_l_7 ? new THREE.CylinderGeometry(endpoint_ear_inner_l_7.endRadius, endpoint_ear_inner_l_7.baseRadius, endpoint_ear_inner_l_7.length, 32, 12) : buildExtrudeGeometry({ "points": [[-0.045, 0], [0.045, 0], [0.016, 0.075], [0, 0.098], [-0.016, 0.075]], "depth": 8e-3 });
  if (!endpoint_ear_inner_l_7) {
    mesh_ear_inner_l_7Geometry.scale(1, 1, 1);
  }
  const mesh_ear_inner_l_7 = new THREE.Mesh(
    mesh_ear_inner_l_7Geometry,
    materialMap["ear-inner"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_ear_inner_l_7.name = "Ear inner L";
  if (endpoint_ear_inner_l_7) {
    mesh_ear_inner_l_7.position.copy(endpoint_ear_inner_l_7.midpoint);
    mesh_ear_inner_l_7.quaternion.copy(endpoint_ear_inner_l_7.quaternion);
  }
  mesh_ear_inner_l_7.castShadow = options.castShadow ?? true;
  mesh_ear_inner_l_7.receiveShadow = options.receiveShadow ?? true;
  node_ear_inner_l_7.add(mesh_ear_inner_l_7);
  meshes["ear-inner-l"] = mesh_ear_inner_l_7;
  colliders["ear-inner-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_ear_inner_l_7);
  const endpoint_eye_rim_l_8 = makeAttachmentEndpoint(null);
  const node_eye_rim_l_8 = new THREE.Group();
  node_eye_rim_l_8.name = "Eye rim L__pivot";
  node_eye_rim_l_8.scale.set(1, 1, 1);
  if (endpoint_eye_rim_l_8) {
    node_eye_rim_l_8.position.copy(endpoint_eye_rim_l_8.start);
    node_eye_rim_l_8.rotation.set(0, 0, 0);
  } else {
    node_eye_rim_l_8.position.set(0.092, 6e-3, 0.2163);
    node_eye_rim_l_8.rotation.set(0, 0, 0);
  }
  node_eye_rim_l_8.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["head"] ?? root).add(node_eye_rim_l_8);
  nodes["eye-rim-l"] = node_eye_rim_l_8;
  const mesh_eye_rim_l_8Geometry = endpoint_eye_rim_l_8 ? new THREE.CylinderGeometry(endpoint_eye_rim_l_8.endRadius, endpoint_eye_rim_l_8.baseRadius, endpoint_eye_rim_l_8.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_eye_rim_l_8) {
    mesh_eye_rim_l_8Geometry.scale(0.098, 0.102, 0.04);
  }
  const mesh_eye_rim_l_8 = new THREE.Mesh(
    mesh_eye_rim_l_8Geometry,
    materialMap["fur-cream"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_eye_rim_l_8.name = "Eye rim L";
  if (endpoint_eye_rim_l_8) {
    mesh_eye_rim_l_8.position.copy(endpoint_eye_rim_l_8.midpoint);
    mesh_eye_rim_l_8.quaternion.copy(endpoint_eye_rim_l_8.quaternion);
  }
  mesh_eye_rim_l_8.castShadow = options.castShadow ?? true;
  mesh_eye_rim_l_8.receiveShadow = options.receiveShadow ?? true;
  node_eye_rim_l_8.add(mesh_eye_rim_l_8);
  meshes["eye-rim-l"] = mesh_eye_rim_l_8;
  colliders["eye-rim-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_eye_rim_l_8);
  const endpoint_eye_l_9 = makeAttachmentEndpoint(null);
  const node_eye_l_9 = new THREE.Group();
  node_eye_l_9.name = "Eye L__pivot";
  node_eye_l_9.scale.set(1, 1, 1);
  if (endpoint_eye_l_9) {
    node_eye_l_9.position.copy(endpoint_eye_l_9.start);
    node_eye_l_9.rotation.set(0, 0, 0);
  } else {
    node_eye_l_9.position.set(0.092, 8e-3, 0.2242);
    node_eye_l_9.rotation.set(0, 0, 0);
  }
  node_eye_l_9.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["head"] ?? root).add(node_eye_l_9);
  nodes["eye-l"] = node_eye_l_9;
  const mesh_eye_l_9Geometry = endpoint_eye_l_9 ? new THREE.CylinderGeometry(endpoint_eye_l_9.endRadius, endpoint_eye_l_9.baseRadius, endpoint_eye_l_9.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_eye_l_9) {
    mesh_eye_l_9Geometry.scale(0.078, 0.082, 0.045);
  }
  const mesh_eye_l_9 = new THREE.Mesh(
    mesh_eye_l_9Geometry,
    materialMap["eye"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_eye_l_9.name = "Eye L";
  if (endpoint_eye_l_9) {
    mesh_eye_l_9.position.copy(endpoint_eye_l_9.midpoint);
    mesh_eye_l_9.quaternion.copy(endpoint_eye_l_9.quaternion);
  }
  mesh_eye_l_9.castShadow = options.castShadow ?? true;
  mesh_eye_l_9.receiveShadow = options.receiveShadow ?? true;
  node_eye_l_9.add(mesh_eye_l_9);
  meshes["eye-l"] = mesh_eye_l_9;
  colliders["eye-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_eye_l_9);
  const endpoint_catchlight_l_10 = makeAttachmentEndpoint(null);
  const node_catchlight_l_10 = new THREE.Group();
  node_catchlight_l_10.name = "Eye catchlight L__pivot";
  node_catchlight_l_10.scale.set(1, 1, 1);
  if (endpoint_catchlight_l_10) {
    node_catchlight_l_10.position.copy(endpoint_catchlight_l_10.start);
    node_catchlight_l_10.rotation.set(0, 0, 0);
  } else {
    node_catchlight_l_10.position.set(0.012, 0.016, 0.02);
    node_catchlight_l_10.rotation.set(0, 0, 0);
  }
  node_catchlight_l_10.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["eye-l"] ?? root).add(node_catchlight_l_10);
  nodes["catchlight-l"] = node_catchlight_l_10;
  const mesh_catchlight_l_10Geometry = endpoint_catchlight_l_10 ? new THREE.CylinderGeometry(endpoint_catchlight_l_10.endRadius, endpoint_catchlight_l_10.baseRadius, endpoint_catchlight_l_10.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_catchlight_l_10) {
    mesh_catchlight_l_10Geometry.scale(0.018, 0.018, 0.012);
  }
  const mesh_catchlight_l_10 = new THREE.Mesh(
    mesh_catchlight_l_10Geometry,
    materialMap["catchlight"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_catchlight_l_10.name = "Eye catchlight L";
  if (endpoint_catchlight_l_10) {
    mesh_catchlight_l_10.position.copy(endpoint_catchlight_l_10.midpoint);
    mesh_catchlight_l_10.quaternion.copy(endpoint_catchlight_l_10.quaternion);
  }
  mesh_catchlight_l_10.castShadow = options.castShadow ?? true;
  mesh_catchlight_l_10.receiveShadow = options.receiveShadow ?? true;
  node_catchlight_l_10.add(mesh_catchlight_l_10);
  meshes["catchlight-l"] = mesh_catchlight_l_10;
  colliders["catchlight-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_catchlight_l_10);
  const endpoint_brow_l_11 = makeAttachmentEndpoint(null);
  const node_brow_l_11 = new THREE.Group();
  node_brow_l_11.name = "Brow dot L__pivot";
  node_brow_l_11.scale.set(1, 1, 1);
  if (endpoint_brow_l_11) {
    node_brow_l_11.position.copy(endpoint_brow_l_11.start);
    node_brow_l_11.rotation.set(0, 0, 0);
  } else {
    node_brow_l_11.position.set(0.072, 0.085, 0.2142);
    node_brow_l_11.rotation.set(0, 0, 0);
  }
  node_brow_l_11.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["head"] ?? root).add(node_brow_l_11);
  nodes["brow-l"] = node_brow_l_11;
  const mesh_brow_l_11Geometry = endpoint_brow_l_11 ? new THREE.CylinderGeometry(endpoint_brow_l_11.endRadius, endpoint_brow_l_11.baseRadius, endpoint_brow_l_11.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_brow_l_11) {
    mesh_brow_l_11Geometry.scale(0.055, 0.034, 0.026);
  }
  const mesh_brow_l_11 = new THREE.Mesh(
    mesh_brow_l_11Geometry,
    materialMap["fur-cream"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_brow_l_11.name = "Brow dot L";
  if (endpoint_brow_l_11) {
    mesh_brow_l_11.position.copy(endpoint_brow_l_11.midpoint);
    mesh_brow_l_11.quaternion.copy(endpoint_brow_l_11.quaternion);
  }
  mesh_brow_l_11.castShadow = options.castShadow ?? true;
  mesh_brow_l_11.receiveShadow = options.receiveShadow ?? true;
  node_brow_l_11.add(mesh_brow_l_11);
  meshes["brow-l"] = mesh_brow_l_11;
  colliders["brow-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_brow_l_11);
  const attachment_arm_l_12 = { "parentSocket": "shoulder-l", "localStart": [0.255, 0.2, 0.02], "localEnd": [0.395, 0.04, 0.06], "contactType": "socket-joint", "baseRadius": 0.058, "endRadius": 0.052, "embedDepth": 0.02, "gapTolerance": 0.01, "evidenceRefs": ["full-object"] };
  const endpoint_arm_l_12 = makeAttachmentEndpoint(attachment_arm_l_12);
  const node_arm_l_12 = new THREE.Group();
  node_arm_l_12.name = "Arm L__pivot";
  node_arm_l_12.scale.set(1, 1, 1);
  if (endpoint_arm_l_12) {
    node_arm_l_12.position.copy(endpoint_arm_l_12.start);
    node_arm_l_12.rotation.set(0, 0, 0);
  } else {
    node_arm_l_12.position.set(0.255, 0.2, 0.02);
    node_arm_l_12.rotation.set(0, 0, 0);
  }
  node_arm_l_12.userData.actionProfile = { "animationRole": "rotate", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_arm_l_12);
  nodes["arm-l"] = node_arm_l_12;
  const mesh_arm_l_12Geometry = endpoint_arm_l_12 ? new THREE.CylinderGeometry(endpoint_arm_l_12.endRadius, endpoint_arm_l_12.baseRadius, endpoint_arm_l_12.length, 32, 12) : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_arm_l_12) {
    mesh_arm_l_12Geometry.scale(0.11, 0.22, 0.11);
  }
  const mesh_arm_l_12 = new THREE.SkinnedMesh(
    mesh_arm_l_12Geometry,
    materialMap["fur-orange"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_arm_l_12.name = "Arm L";
  if (endpoint_arm_l_12) {
    mesh_arm_l_12.position.copy(endpoint_arm_l_12.midpoint);
    mesh_arm_l_12.quaternion.copy(endpoint_arm_l_12.quaternion);
  }
  mesh_arm_l_12.castShadow = options.castShadow ?? true;
  mesh_arm_l_12.receiveShadow = options.receiveShadow ?? true;
  node_arm_l_12.add(mesh_arm_l_12);
  meshes["arm-l"] = mesh_arm_l_12;
  colliders["arm-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_arm_l_12);
  const endpoint_paw_l_13 = makeAttachmentEndpoint(null);
  const node_paw_l_13 = new THREE.Group();
  node_paw_l_13.name = "Paw tip L__pivot";
  node_paw_l_13.scale.set(1, 1, 1);
  if (endpoint_paw_l_13) {
    node_paw_l_13.position.copy(endpoint_paw_l_13.start);
    node_paw_l_13.rotation.set(0, 0, 0);
  } else {
    node_paw_l_13.position.set(0.405, 0.025, 0.065);
    node_paw_l_13.rotation.set(0, 0, 0);
  }
  node_paw_l_13.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_paw_l_13);
  nodes["paw-l"] = node_paw_l_13;
  const mesh_paw_l_13Geometry = endpoint_paw_l_13 ? new THREE.CylinderGeometry(endpoint_paw_l_13.endRadius, endpoint_paw_l_13.baseRadius, endpoint_paw_l_13.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_paw_l_13) {
    mesh_paw_l_13Geometry.scale(0.11, 0.105, 0.105);
  }
  const mesh_paw_l_13 = new THREE.Mesh(
    mesh_paw_l_13Geometry,
    materialMap["fur-cream"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_paw_l_13.name = "Paw tip L";
  if (endpoint_paw_l_13) {
    mesh_paw_l_13.position.copy(endpoint_paw_l_13.midpoint);
    mesh_paw_l_13.quaternion.copy(endpoint_paw_l_13.quaternion);
  }
  mesh_paw_l_13.castShadow = options.castShadow ?? true;
  mesh_paw_l_13.receiveShadow = options.receiveShadow ?? true;
  node_paw_l_13.add(mesh_paw_l_13);
  meshes["paw-l"] = mesh_paw_l_13;
  colliders["paw-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_paw_l_13);
  const attachment_leg_l_14 = { "parentSocket": "hip-l", "localStart": [0.13, -0.13, 0], "localEnd": [0.13, -0.27, 0.02], "contactType": "socket-joint", "baseRadius": 0.07, "endRadius": 0.068, "embedDepth": 0.02, "gapTolerance": 0.01, "evidenceRefs": ["full-object"] };
  const endpoint_leg_l_14 = makeAttachmentEndpoint(attachment_leg_l_14);
  const node_leg_l_14 = new THREE.Group();
  node_leg_l_14.name = "Leg L__pivot";
  node_leg_l_14.scale.set(1, 1, 1);
  if (endpoint_leg_l_14) {
    node_leg_l_14.position.copy(endpoint_leg_l_14.start);
    node_leg_l_14.rotation.set(0, 0, 0);
  } else {
    node_leg_l_14.position.set(0.13, -0.13, 0);
    node_leg_l_14.rotation.set(0, 0, 0);
  }
  node_leg_l_14.userData.actionProfile = { "animationRole": "rotate", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_leg_l_14);
  nodes["leg-l"] = node_leg_l_14;
  const mesh_leg_l_14Geometry = endpoint_leg_l_14 ? new THREE.CylinderGeometry(endpoint_leg_l_14.endRadius, endpoint_leg_l_14.baseRadius, endpoint_leg_l_14.length, 32, 12) : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_leg_l_14) {
    mesh_leg_l_14Geometry.scale(0.14, 0.14, 0.14);
  }
  const mesh_leg_l_14 = new THREE.SkinnedMesh(
    mesh_leg_l_14Geometry,
    materialMap["fur-orange"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_leg_l_14.name = "Leg L";
  if (endpoint_leg_l_14) {
    mesh_leg_l_14.position.copy(endpoint_leg_l_14.midpoint);
    mesh_leg_l_14.quaternion.copy(endpoint_leg_l_14.quaternion);
  }
  mesh_leg_l_14.castShadow = options.castShadow ?? true;
  mesh_leg_l_14.receiveShadow = options.receiveShadow ?? true;
  node_leg_l_14.add(mesh_leg_l_14);
  meshes["leg-l"] = mesh_leg_l_14;
  colliders["leg-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_leg_l_14);
  const endpoint_foot_l_15 = makeAttachmentEndpoint(null);
  const node_foot_l_15 = new THREE.Group();
  node_foot_l_15.name = "Foot L__pivot";
  node_foot_l_15.scale.set(1, 1, 1);
  if (endpoint_foot_l_15) {
    node_foot_l_15.position.copy(endpoint_foot_l_15.start);
    node_foot_l_15.rotation.set(0, 0, 0);
  } else {
    node_foot_l_15.position.set(0.13, 0.035, 0.035);
    node_foot_l_15.rotation.set(0, 0, 0);
  }
  node_foot_l_15.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["root"] ?? root).add(node_foot_l_15);
  nodes["foot-l"] = node_foot_l_15;
  const mesh_foot_l_15Geometry = endpoint_foot_l_15 ? new THREE.CylinderGeometry(endpoint_foot_l_15.endRadius, endpoint_foot_l_15.baseRadius, endpoint_foot_l_15.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_foot_l_15) {
    mesh_foot_l_15Geometry.scale(0.14, 0.075, 0.18);
  }
  const mesh_foot_l_15 = new THREE.Mesh(
    mesh_foot_l_15Geometry,
    materialMap["fur-cream"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_foot_l_15.name = "Foot L";
  if (endpoint_foot_l_15) {
    mesh_foot_l_15.position.copy(endpoint_foot_l_15.midpoint);
    mesh_foot_l_15.quaternion.copy(endpoint_foot_l_15.quaternion);
  }
  mesh_foot_l_15.castShadow = options.castShadow ?? true;
  mesh_foot_l_15.receiveShadow = options.receiveShadow ?? true;
  node_foot_l_15.add(mesh_foot_l_15);
  meshes["foot-l"] = mesh_foot_l_15;
  colliders["foot-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_foot_l_15);
  const endpoint_pouch_l_16 = makeAttachmentEndpoint(null);
  const node_pouch_l_16 = new THREE.Group();
  node_pouch_l_16.name = "Pouch L__pivot";
  node_pouch_l_16.scale.set(1, 1, 1);
  if (endpoint_pouch_l_16) {
    node_pouch_l_16.position.copy(endpoint_pouch_l_16.start);
    node_pouch_l_16.rotation.set(0, 0.69813, 0);
  } else {
    node_pouch_l_16.position.set(0.255, -0.07, 0.13);
    node_pouch_l_16.rotation.set(0, 0.69813, 0);
  }
  node_pouch_l_16.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_pouch_l_16);
  nodes["pouch-l"] = node_pouch_l_16;
  const mesh_pouch_l_16Geometry = endpoint_pouch_l_16 ? new THREE.CylinderGeometry(endpoint_pouch_l_16.endRadius, endpoint_pouch_l_16.baseRadius, endpoint_pouch_l_16.length, 32, 12) : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pouch_l_16) {
    mesh_pouch_l_16Geometry.scale(0.1, 0.12, 0.07);
  }
  const mesh_pouch_l_16 = new THREE.Mesh(
    mesh_pouch_l_16Geometry,
    materialMap["leather"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_pouch_l_16.name = "Pouch L";
  if (endpoint_pouch_l_16) {
    mesh_pouch_l_16.position.copy(endpoint_pouch_l_16.midpoint);
    mesh_pouch_l_16.quaternion.copy(endpoint_pouch_l_16.quaternion);
  }
  mesh_pouch_l_16.castShadow = options.castShadow ?? true;
  mesh_pouch_l_16.receiveShadow = options.receiveShadow ?? true;
  node_pouch_l_16.add(mesh_pouch_l_16);
  meshes["pouch-l"] = mesh_pouch_l_16;
  colliders["pouch-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_pouch_l_16);
  const endpoint_pouch_flap_l_17 = makeAttachmentEndpoint(null);
  const node_pouch_flap_l_17 = new THREE.Group();
  node_pouch_flap_l_17.name = "Pouch flap L__pivot";
  node_pouch_flap_l_17.scale.set(1, 1, 1);
  if (endpoint_pouch_flap_l_17) {
    node_pouch_flap_l_17.position.copy(endpoint_pouch_flap_l_17.start);
    node_pouch_flap_l_17.rotation.set(0, 0, 0);
  } else {
    node_pouch_flap_l_17.position.set(0, 0.035, 0.035);
    node_pouch_flap_l_17.rotation.set(0, 0, 0);
  }
  node_pouch_flap_l_17.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["pouch-l"] ?? root).add(node_pouch_flap_l_17);
  nodes["pouch-flap-l"] = node_pouch_flap_l_17;
  const mesh_pouch_flap_l_17Geometry = endpoint_pouch_flap_l_17 ? new THREE.CylinderGeometry(endpoint_pouch_flap_l_17.endRadius, endpoint_pouch_flap_l_17.baseRadius, endpoint_pouch_flap_l_17.length, 32, 12) : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pouch_flap_l_17) {
    mesh_pouch_flap_l_17Geometry.scale(0.105, 0.06, 0.012);
  }
  const mesh_pouch_flap_l_17 = new THREE.Mesh(
    mesh_pouch_flap_l_17Geometry,
    materialMap["leather-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_pouch_flap_l_17.name = "Pouch flap L";
  if (endpoint_pouch_flap_l_17) {
    mesh_pouch_flap_l_17.position.copy(endpoint_pouch_flap_l_17.midpoint);
    mesh_pouch_flap_l_17.quaternion.copy(endpoint_pouch_flap_l_17.quaternion);
  }
  mesh_pouch_flap_l_17.castShadow = options.castShadow ?? true;
  mesh_pouch_flap_l_17.receiveShadow = options.receiveShadow ?? true;
  node_pouch_flap_l_17.add(mesh_pouch_flap_l_17);
  meshes["pouch-flap-l"] = mesh_pouch_flap_l_17;
  colliders["pouch-flap-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_pouch_flap_l_17);
  const endpoint_pouch_stud_l_18 = makeAttachmentEndpoint(null);
  const node_pouch_stud_l_18 = new THREE.Group();
  node_pouch_stud_l_18.name = "Pouch stud L__pivot";
  node_pouch_stud_l_18.scale.set(1, 1, 1);
  if (endpoint_pouch_stud_l_18) {
    node_pouch_stud_l_18.position.copy(endpoint_pouch_stud_l_18.start);
    node_pouch_stud_l_18.rotation.set(0, 0, 0);
  } else {
    node_pouch_stud_l_18.position.set(0, 0.02, 0.043);
    node_pouch_stud_l_18.rotation.set(0, 0, 0);
  }
  node_pouch_stud_l_18.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["pouch-l"] ?? root).add(node_pouch_stud_l_18);
  nodes["pouch-stud-l"] = node_pouch_stud_l_18;
  const mesh_pouch_stud_l_18Geometry = endpoint_pouch_stud_l_18 ? new THREE.CylinderGeometry(endpoint_pouch_stud_l_18.endRadius, endpoint_pouch_stud_l_18.baseRadius, endpoint_pouch_stud_l_18.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_pouch_stud_l_18) {
    mesh_pouch_stud_l_18Geometry.scale(0.016, 0.016, 0.01);
  }
  const mesh_pouch_stud_l_18 = new THREE.Mesh(
    mesh_pouch_stud_l_18Geometry,
    materialMap["brass"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_pouch_stud_l_18.name = "Pouch stud L";
  if (endpoint_pouch_stud_l_18) {
    mesh_pouch_stud_l_18.position.copy(endpoint_pouch_stud_l_18.midpoint);
    mesh_pouch_stud_l_18.quaternion.copy(endpoint_pouch_stud_l_18.quaternion);
  }
  mesh_pouch_stud_l_18.castShadow = options.castShadow ?? true;
  mesh_pouch_stud_l_18.receiveShadow = options.receiveShadow ?? true;
  node_pouch_stud_l_18.add(mesh_pouch_stud_l_18);
  meshes["pouch-stud-l"] = mesh_pouch_stud_l_18;
  colliders["pouch-stud-l"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_pouch_stud_l_18);
  const endpoint_ear_r_19 = makeAttachmentEndpoint(null);
  const node_ear_r_19 = new THREE.Group();
  node_ear_r_19.name = "Ear R__pivot";
  node_ear_r_19.scale.set(1, 1, 1);
  if (endpoint_ear_r_19) {
    node_ear_r_19.position.copy(endpoint_ear_r_19.start);
    node_ear_r_19.rotation.set(-0.13963, 0, 0.24435);
  } else {
    node_ear_r_19.position.set(-0.145, 0.115, -0.03);
    node_ear_r_19.rotation.set(-0.13963, 0, 0.24435);
  }
  node_ear_r_19.userData.actionProfile = { "animationRole": "rotate", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["head"] ?? root).add(node_ear_r_19);
  nodes["ear-r"] = node_ear_r_19;
  const mesh_ear_r_19Geometry = endpoint_ear_r_19 ? new THREE.CylinderGeometry(endpoint_ear_r_19.endRadius, endpoint_ear_r_19.baseRadius, endpoint_ear_r_19.length, 32, 12) : buildExtrudeGeometry({ "points": [[-0.072, 0], [0.072, 0], [0.03, 0.09], [8e-3, 0.135], [-8e-3, 0.135], [-0.03, 0.09]], "depth": 0.05 });
  if (!endpoint_ear_r_19) {
    mesh_ear_r_19Geometry.scale(1, 1, 1);
  }
  const mesh_ear_r_19 = new THREE.SkinnedMesh(
    mesh_ear_r_19Geometry,
    materialMap["fur-orange"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_ear_r_19.name = "Ear R";
  if (endpoint_ear_r_19) {
    mesh_ear_r_19.position.copy(endpoint_ear_r_19.midpoint);
    mesh_ear_r_19.quaternion.copy(endpoint_ear_r_19.quaternion);
  }
  mesh_ear_r_19.castShadow = options.castShadow ?? true;
  mesh_ear_r_19.receiveShadow = options.receiveShadow ?? true;
  node_ear_r_19.add(mesh_ear_r_19);
  meshes["ear-r"] = mesh_ear_r_19;
  colliders["ear-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_ear_r_19);
  const endpoint_ear_inner_r_20 = makeAttachmentEndpoint(null);
  const node_ear_inner_r_20 = new THREE.Group();
  node_ear_inner_r_20.name = "Ear inner R__pivot";
  node_ear_inner_r_20.scale.set(1, 1, 1);
  if (endpoint_ear_inner_r_20) {
    node_ear_inner_r_20.position.copy(endpoint_ear_inner_r_20.start);
    node_ear_inner_r_20.rotation.set(0, 0, 0);
  } else {
    node_ear_inner_r_20.position.set(0, 0.012, 0.051);
    node_ear_inner_r_20.rotation.set(0, 0, 0);
  }
  node_ear_inner_r_20.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["ear-r"] ?? root).add(node_ear_inner_r_20);
  nodes["ear-inner-r"] = node_ear_inner_r_20;
  const mesh_ear_inner_r_20Geometry = endpoint_ear_inner_r_20 ? new THREE.CylinderGeometry(endpoint_ear_inner_r_20.endRadius, endpoint_ear_inner_r_20.baseRadius, endpoint_ear_inner_r_20.length, 32, 12) : buildExtrudeGeometry({ "points": [[-0.045, 0], [0.045, 0], [0.016, 0.075], [0, 0.098], [-0.016, 0.075]], "depth": 8e-3 });
  if (!endpoint_ear_inner_r_20) {
    mesh_ear_inner_r_20Geometry.scale(1, 1, 1);
  }
  const mesh_ear_inner_r_20 = new THREE.Mesh(
    mesh_ear_inner_r_20Geometry,
    materialMap["ear-inner"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_ear_inner_r_20.name = "Ear inner R";
  if (endpoint_ear_inner_r_20) {
    mesh_ear_inner_r_20.position.copy(endpoint_ear_inner_r_20.midpoint);
    mesh_ear_inner_r_20.quaternion.copy(endpoint_ear_inner_r_20.quaternion);
  }
  mesh_ear_inner_r_20.castShadow = options.castShadow ?? true;
  mesh_ear_inner_r_20.receiveShadow = options.receiveShadow ?? true;
  node_ear_inner_r_20.add(mesh_ear_inner_r_20);
  meshes["ear-inner-r"] = mesh_ear_inner_r_20;
  colliders["ear-inner-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_ear_inner_r_20);
  const endpoint_eye_rim_r_21 = makeAttachmentEndpoint(null);
  const node_eye_rim_r_21 = new THREE.Group();
  node_eye_rim_r_21.name = "Eye rim R__pivot";
  node_eye_rim_r_21.scale.set(1, 1, 1);
  if (endpoint_eye_rim_r_21) {
    node_eye_rim_r_21.position.copy(endpoint_eye_rim_r_21.start);
    node_eye_rim_r_21.rotation.set(0, 0, 0);
  } else {
    node_eye_rim_r_21.position.set(-0.092, 6e-3, 0.2163);
    node_eye_rim_r_21.rotation.set(0, 0, 0);
  }
  node_eye_rim_r_21.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["head"] ?? root).add(node_eye_rim_r_21);
  nodes["eye-rim-r"] = node_eye_rim_r_21;
  const mesh_eye_rim_r_21Geometry = endpoint_eye_rim_r_21 ? new THREE.CylinderGeometry(endpoint_eye_rim_r_21.endRadius, endpoint_eye_rim_r_21.baseRadius, endpoint_eye_rim_r_21.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_eye_rim_r_21) {
    mesh_eye_rim_r_21Geometry.scale(0.098, 0.102, 0.04);
  }
  const mesh_eye_rim_r_21 = new THREE.Mesh(
    mesh_eye_rim_r_21Geometry,
    materialMap["fur-cream"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_eye_rim_r_21.name = "Eye rim R";
  if (endpoint_eye_rim_r_21) {
    mesh_eye_rim_r_21.position.copy(endpoint_eye_rim_r_21.midpoint);
    mesh_eye_rim_r_21.quaternion.copy(endpoint_eye_rim_r_21.quaternion);
  }
  mesh_eye_rim_r_21.castShadow = options.castShadow ?? true;
  mesh_eye_rim_r_21.receiveShadow = options.receiveShadow ?? true;
  node_eye_rim_r_21.add(mesh_eye_rim_r_21);
  meshes["eye-rim-r"] = mesh_eye_rim_r_21;
  colliders["eye-rim-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_eye_rim_r_21);
  const endpoint_eye_r_22 = makeAttachmentEndpoint(null);
  const node_eye_r_22 = new THREE.Group();
  node_eye_r_22.name = "Eye R__pivot";
  node_eye_r_22.scale.set(1, 1, 1);
  if (endpoint_eye_r_22) {
    node_eye_r_22.position.copy(endpoint_eye_r_22.start);
    node_eye_r_22.rotation.set(0, 0, 0);
  } else {
    node_eye_r_22.position.set(-0.092, 8e-3, 0.2242);
    node_eye_r_22.rotation.set(0, 0, 0);
  }
  node_eye_r_22.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["head"] ?? root).add(node_eye_r_22);
  nodes["eye-r"] = node_eye_r_22;
  const mesh_eye_r_22Geometry = endpoint_eye_r_22 ? new THREE.CylinderGeometry(endpoint_eye_r_22.endRadius, endpoint_eye_r_22.baseRadius, endpoint_eye_r_22.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_eye_r_22) {
    mesh_eye_r_22Geometry.scale(0.078, 0.082, 0.045);
  }
  const mesh_eye_r_22 = new THREE.Mesh(
    mesh_eye_r_22Geometry,
    materialMap["eye"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_eye_r_22.name = "Eye R";
  if (endpoint_eye_r_22) {
    mesh_eye_r_22.position.copy(endpoint_eye_r_22.midpoint);
    mesh_eye_r_22.quaternion.copy(endpoint_eye_r_22.quaternion);
  }
  mesh_eye_r_22.castShadow = options.castShadow ?? true;
  mesh_eye_r_22.receiveShadow = options.receiveShadow ?? true;
  node_eye_r_22.add(mesh_eye_r_22);
  meshes["eye-r"] = mesh_eye_r_22;
  colliders["eye-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_eye_r_22);
  const endpoint_catchlight_r_23 = makeAttachmentEndpoint(null);
  const node_catchlight_r_23 = new THREE.Group();
  node_catchlight_r_23.name = "Eye catchlight R__pivot";
  node_catchlight_r_23.scale.set(1, 1, 1);
  if (endpoint_catchlight_r_23) {
    node_catchlight_r_23.position.copy(endpoint_catchlight_r_23.start);
    node_catchlight_r_23.rotation.set(0, 0, 0);
  } else {
    node_catchlight_r_23.position.set(-0.012, 0.016, 0.02);
    node_catchlight_r_23.rotation.set(0, 0, 0);
  }
  node_catchlight_r_23.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["eye-r"] ?? root).add(node_catchlight_r_23);
  nodes["catchlight-r"] = node_catchlight_r_23;
  const mesh_catchlight_r_23Geometry = endpoint_catchlight_r_23 ? new THREE.CylinderGeometry(endpoint_catchlight_r_23.endRadius, endpoint_catchlight_r_23.baseRadius, endpoint_catchlight_r_23.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_catchlight_r_23) {
    mesh_catchlight_r_23Geometry.scale(0.018, 0.018, 0.012);
  }
  const mesh_catchlight_r_23 = new THREE.Mesh(
    mesh_catchlight_r_23Geometry,
    materialMap["catchlight"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_catchlight_r_23.name = "Eye catchlight R";
  if (endpoint_catchlight_r_23) {
    mesh_catchlight_r_23.position.copy(endpoint_catchlight_r_23.midpoint);
    mesh_catchlight_r_23.quaternion.copy(endpoint_catchlight_r_23.quaternion);
  }
  mesh_catchlight_r_23.castShadow = options.castShadow ?? true;
  mesh_catchlight_r_23.receiveShadow = options.receiveShadow ?? true;
  node_catchlight_r_23.add(mesh_catchlight_r_23);
  meshes["catchlight-r"] = mesh_catchlight_r_23;
  colliders["catchlight-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_catchlight_r_23);
  const endpoint_brow_r_24 = makeAttachmentEndpoint(null);
  const node_brow_r_24 = new THREE.Group();
  node_brow_r_24.name = "Brow dot R__pivot";
  node_brow_r_24.scale.set(1, 1, 1);
  if (endpoint_brow_r_24) {
    node_brow_r_24.position.copy(endpoint_brow_r_24.start);
    node_brow_r_24.rotation.set(0, 0, 0);
  } else {
    node_brow_r_24.position.set(-0.072, 0.085, 0.2142);
    node_brow_r_24.rotation.set(0, 0, 0);
  }
  node_brow_r_24.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["head"] ?? root).add(node_brow_r_24);
  nodes["brow-r"] = node_brow_r_24;
  const mesh_brow_r_24Geometry = endpoint_brow_r_24 ? new THREE.CylinderGeometry(endpoint_brow_r_24.endRadius, endpoint_brow_r_24.baseRadius, endpoint_brow_r_24.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_brow_r_24) {
    mesh_brow_r_24Geometry.scale(0.055, 0.034, 0.026);
  }
  const mesh_brow_r_24 = new THREE.Mesh(
    mesh_brow_r_24Geometry,
    materialMap["fur-cream"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_brow_r_24.name = "Brow dot R";
  if (endpoint_brow_r_24) {
    mesh_brow_r_24.position.copy(endpoint_brow_r_24.midpoint);
    mesh_brow_r_24.quaternion.copy(endpoint_brow_r_24.quaternion);
  }
  mesh_brow_r_24.castShadow = options.castShadow ?? true;
  mesh_brow_r_24.receiveShadow = options.receiveShadow ?? true;
  node_brow_r_24.add(mesh_brow_r_24);
  meshes["brow-r"] = mesh_brow_r_24;
  colliders["brow-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_brow_r_24);
  const attachment_arm_r_25 = { "parentSocket": "shoulder-r", "localStart": [-0.255, 0.2, 0.02], "localEnd": [-0.395, 0.04, 0.06], "contactType": "socket-joint", "baseRadius": 0.058, "endRadius": 0.052, "embedDepth": 0.02, "gapTolerance": 0.01, "evidenceRefs": ["full-object"] };
  const endpoint_arm_r_25 = makeAttachmentEndpoint(attachment_arm_r_25);
  const node_arm_r_25 = new THREE.Group();
  node_arm_r_25.name = "Arm R__pivot";
  node_arm_r_25.scale.set(1, 1, 1);
  if (endpoint_arm_r_25) {
    node_arm_r_25.position.copy(endpoint_arm_r_25.start);
    node_arm_r_25.rotation.set(0, 0, 0);
  } else {
    node_arm_r_25.position.set(-0.255, 0.2, 0.02);
    node_arm_r_25.rotation.set(0, 0, 0);
  }
  node_arm_r_25.userData.actionProfile = { "animationRole": "rotate", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_arm_r_25);
  nodes["arm-r"] = node_arm_r_25;
  const mesh_arm_r_25Geometry = endpoint_arm_r_25 ? new THREE.CylinderGeometry(endpoint_arm_r_25.endRadius, endpoint_arm_r_25.baseRadius, endpoint_arm_r_25.length, 32, 12) : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_arm_r_25) {
    mesh_arm_r_25Geometry.scale(0.11, 0.22, 0.11);
  }
  const mesh_arm_r_25 = new THREE.SkinnedMesh(
    mesh_arm_r_25Geometry,
    materialMap["fur-orange"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_arm_r_25.name = "Arm R";
  if (endpoint_arm_r_25) {
    mesh_arm_r_25.position.copy(endpoint_arm_r_25.midpoint);
    mesh_arm_r_25.quaternion.copy(endpoint_arm_r_25.quaternion);
  }
  mesh_arm_r_25.castShadow = options.castShadow ?? true;
  mesh_arm_r_25.receiveShadow = options.receiveShadow ?? true;
  node_arm_r_25.add(mesh_arm_r_25);
  meshes["arm-r"] = mesh_arm_r_25;
  colliders["arm-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_arm_r_25);
  const endpoint_paw_r_26 = makeAttachmentEndpoint(null);
  const node_paw_r_26 = new THREE.Group();
  node_paw_r_26.name = "Paw tip R__pivot";
  node_paw_r_26.scale.set(1, 1, 1);
  if (endpoint_paw_r_26) {
    node_paw_r_26.position.copy(endpoint_paw_r_26.start);
    node_paw_r_26.rotation.set(0, 0, 0);
  } else {
    node_paw_r_26.position.set(-0.405, 0.025, 0.065);
    node_paw_r_26.rotation.set(0, 0, 0);
  }
  node_paw_r_26.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_paw_r_26);
  nodes["paw-r"] = node_paw_r_26;
  const mesh_paw_r_26Geometry = endpoint_paw_r_26 ? new THREE.CylinderGeometry(endpoint_paw_r_26.endRadius, endpoint_paw_r_26.baseRadius, endpoint_paw_r_26.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_paw_r_26) {
    mesh_paw_r_26Geometry.scale(0.11, 0.105, 0.105);
  }
  const mesh_paw_r_26 = new THREE.Mesh(
    mesh_paw_r_26Geometry,
    materialMap["fur-cream"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_paw_r_26.name = "Paw tip R";
  if (endpoint_paw_r_26) {
    mesh_paw_r_26.position.copy(endpoint_paw_r_26.midpoint);
    mesh_paw_r_26.quaternion.copy(endpoint_paw_r_26.quaternion);
  }
  mesh_paw_r_26.castShadow = options.castShadow ?? true;
  mesh_paw_r_26.receiveShadow = options.receiveShadow ?? true;
  node_paw_r_26.add(mesh_paw_r_26);
  meshes["paw-r"] = mesh_paw_r_26;
  colliders["paw-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_paw_r_26);
  const attachment_leg_r_27 = { "parentSocket": "hip-r", "localStart": [-0.13, -0.13, 0], "localEnd": [-0.13, -0.27, 0.02], "contactType": "socket-joint", "baseRadius": 0.07, "endRadius": 0.068, "embedDepth": 0.02, "gapTolerance": 0.01, "evidenceRefs": ["full-object"] };
  const endpoint_leg_r_27 = makeAttachmentEndpoint(attachment_leg_r_27);
  const node_leg_r_27 = new THREE.Group();
  node_leg_r_27.name = "Leg R__pivot";
  node_leg_r_27.scale.set(1, 1, 1);
  if (endpoint_leg_r_27) {
    node_leg_r_27.position.copy(endpoint_leg_r_27.start);
    node_leg_r_27.rotation.set(0, 0, 0);
  } else {
    node_leg_r_27.position.set(-0.13, -0.13, 0);
    node_leg_r_27.rotation.set(0, 0, 0);
  }
  node_leg_r_27.userData.actionProfile = { "animationRole": "rotate", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_leg_r_27);
  nodes["leg-r"] = node_leg_r_27;
  const mesh_leg_r_27Geometry = endpoint_leg_r_27 ? new THREE.CylinderGeometry(endpoint_leg_r_27.endRadius, endpoint_leg_r_27.baseRadius, endpoint_leg_r_27.length, 32, 12) : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_leg_r_27) {
    mesh_leg_r_27Geometry.scale(0.14, 0.14, 0.14);
  }
  const mesh_leg_r_27 = new THREE.SkinnedMesh(
    mesh_leg_r_27Geometry,
    materialMap["fur-orange"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_leg_r_27.name = "Leg R";
  if (endpoint_leg_r_27) {
    mesh_leg_r_27.position.copy(endpoint_leg_r_27.midpoint);
    mesh_leg_r_27.quaternion.copy(endpoint_leg_r_27.quaternion);
  }
  mesh_leg_r_27.castShadow = options.castShadow ?? true;
  mesh_leg_r_27.receiveShadow = options.receiveShadow ?? true;
  node_leg_r_27.add(mesh_leg_r_27);
  meshes["leg-r"] = mesh_leg_r_27;
  colliders["leg-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_leg_r_27);
  const endpoint_foot_r_28 = makeAttachmentEndpoint(null);
  const node_foot_r_28 = new THREE.Group();
  node_foot_r_28.name = "Foot R__pivot";
  node_foot_r_28.scale.set(1, 1, 1);
  if (endpoint_foot_r_28) {
    node_foot_r_28.position.copy(endpoint_foot_r_28.start);
    node_foot_r_28.rotation.set(0, 0, 0);
  } else {
    node_foot_r_28.position.set(-0.13, 0.035, 0.035);
    node_foot_r_28.rotation.set(0, 0, 0);
  }
  node_foot_r_28.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["root"] ?? root).add(node_foot_r_28);
  nodes["foot-r"] = node_foot_r_28;
  const mesh_foot_r_28Geometry = endpoint_foot_r_28 ? new THREE.CylinderGeometry(endpoint_foot_r_28.endRadius, endpoint_foot_r_28.baseRadius, endpoint_foot_r_28.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_foot_r_28) {
    mesh_foot_r_28Geometry.scale(0.14, 0.075, 0.18);
  }
  const mesh_foot_r_28 = new THREE.Mesh(
    mesh_foot_r_28Geometry,
    materialMap["fur-cream"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_foot_r_28.name = "Foot R";
  if (endpoint_foot_r_28) {
    mesh_foot_r_28.position.copy(endpoint_foot_r_28.midpoint);
    mesh_foot_r_28.quaternion.copy(endpoint_foot_r_28.quaternion);
  }
  mesh_foot_r_28.castShadow = options.castShadow ?? true;
  mesh_foot_r_28.receiveShadow = options.receiveShadow ?? true;
  node_foot_r_28.add(mesh_foot_r_28);
  meshes["foot-r"] = mesh_foot_r_28;
  colliders["foot-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_foot_r_28);
  const endpoint_pouch_r_29 = makeAttachmentEndpoint(null);
  const node_pouch_r_29 = new THREE.Group();
  node_pouch_r_29.name = "Pouch R__pivot";
  node_pouch_r_29.scale.set(1, 1, 1);
  if (endpoint_pouch_r_29) {
    node_pouch_r_29.position.copy(endpoint_pouch_r_29.start);
    node_pouch_r_29.rotation.set(0, -0.69813, 0);
  } else {
    node_pouch_r_29.position.set(-0.255, -0.07, 0.13);
    node_pouch_r_29.rotation.set(0, -0.69813, 0);
  }
  node_pouch_r_29.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_pouch_r_29);
  nodes["pouch-r"] = node_pouch_r_29;
  const mesh_pouch_r_29Geometry = endpoint_pouch_r_29 ? new THREE.CylinderGeometry(endpoint_pouch_r_29.endRadius, endpoint_pouch_r_29.baseRadius, endpoint_pouch_r_29.length, 32, 12) : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pouch_r_29) {
    mesh_pouch_r_29Geometry.scale(0.1, 0.12, 0.07);
  }
  const mesh_pouch_r_29 = new THREE.Mesh(
    mesh_pouch_r_29Geometry,
    materialMap["leather"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_pouch_r_29.name = "Pouch R";
  if (endpoint_pouch_r_29) {
    mesh_pouch_r_29.position.copy(endpoint_pouch_r_29.midpoint);
    mesh_pouch_r_29.quaternion.copy(endpoint_pouch_r_29.quaternion);
  }
  mesh_pouch_r_29.castShadow = options.castShadow ?? true;
  mesh_pouch_r_29.receiveShadow = options.receiveShadow ?? true;
  node_pouch_r_29.add(mesh_pouch_r_29);
  meshes["pouch-r"] = mesh_pouch_r_29;
  colliders["pouch-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_pouch_r_29);
  const endpoint_pouch_flap_r_30 = makeAttachmentEndpoint(null);
  const node_pouch_flap_r_30 = new THREE.Group();
  node_pouch_flap_r_30.name = "Pouch flap R__pivot";
  node_pouch_flap_r_30.scale.set(1, 1, 1);
  if (endpoint_pouch_flap_r_30) {
    node_pouch_flap_r_30.position.copy(endpoint_pouch_flap_r_30.start);
    node_pouch_flap_r_30.rotation.set(0, 0, 0);
  } else {
    node_pouch_flap_r_30.position.set(0, 0.035, 0.035);
    node_pouch_flap_r_30.rotation.set(0, 0, 0);
  }
  node_pouch_flap_r_30.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["pouch-r"] ?? root).add(node_pouch_flap_r_30);
  nodes["pouch-flap-r"] = node_pouch_flap_r_30;
  const mesh_pouch_flap_r_30Geometry = endpoint_pouch_flap_r_30 ? new THREE.CylinderGeometry(endpoint_pouch_flap_r_30.endRadius, endpoint_pouch_flap_r_30.baseRadius, endpoint_pouch_flap_r_30.length, 32, 12) : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pouch_flap_r_30) {
    mesh_pouch_flap_r_30Geometry.scale(0.105, 0.06, 0.012);
  }
  const mesh_pouch_flap_r_30 = new THREE.Mesh(
    mesh_pouch_flap_r_30Geometry,
    materialMap["leather-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_pouch_flap_r_30.name = "Pouch flap R";
  if (endpoint_pouch_flap_r_30) {
    mesh_pouch_flap_r_30.position.copy(endpoint_pouch_flap_r_30.midpoint);
    mesh_pouch_flap_r_30.quaternion.copy(endpoint_pouch_flap_r_30.quaternion);
  }
  mesh_pouch_flap_r_30.castShadow = options.castShadow ?? true;
  mesh_pouch_flap_r_30.receiveShadow = options.receiveShadow ?? true;
  node_pouch_flap_r_30.add(mesh_pouch_flap_r_30);
  meshes["pouch-flap-r"] = mesh_pouch_flap_r_30;
  colliders["pouch-flap-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_pouch_flap_r_30);
  const endpoint_pouch_stud_r_31 = makeAttachmentEndpoint(null);
  const node_pouch_stud_r_31 = new THREE.Group();
  node_pouch_stud_r_31.name = "Pouch stud R__pivot";
  node_pouch_stud_r_31.scale.set(1, 1, 1);
  if (endpoint_pouch_stud_r_31) {
    node_pouch_stud_r_31.position.copy(endpoint_pouch_stud_r_31.start);
    node_pouch_stud_r_31.rotation.set(0, 0, 0);
  } else {
    node_pouch_stud_r_31.position.set(0, 0.02, 0.043);
    node_pouch_stud_r_31.rotation.set(0, 0, 0);
  }
  node_pouch_stud_r_31.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["pouch-r"] ?? root).add(node_pouch_stud_r_31);
  nodes["pouch-stud-r"] = node_pouch_stud_r_31;
  const mesh_pouch_stud_r_31Geometry = endpoint_pouch_stud_r_31 ? new THREE.CylinderGeometry(endpoint_pouch_stud_r_31.endRadius, endpoint_pouch_stud_r_31.baseRadius, endpoint_pouch_stud_r_31.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_pouch_stud_r_31) {
    mesh_pouch_stud_r_31Geometry.scale(0.016, 0.016, 0.01);
  }
  const mesh_pouch_stud_r_31 = new THREE.Mesh(
    mesh_pouch_stud_r_31Geometry,
    materialMap["brass"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_pouch_stud_r_31.name = "Pouch stud R";
  if (endpoint_pouch_stud_r_31) {
    mesh_pouch_stud_r_31.position.copy(endpoint_pouch_stud_r_31.midpoint);
    mesh_pouch_stud_r_31.quaternion.copy(endpoint_pouch_stud_r_31.quaternion);
  }
  mesh_pouch_stud_r_31.castShadow = options.castShadow ?? true;
  mesh_pouch_stud_r_31.receiveShadow = options.receiveShadow ?? true;
  node_pouch_stud_r_31.add(mesh_pouch_stud_r_31);
  meshes["pouch-stud-r"] = mesh_pouch_stud_r_31;
  colliders["pouch-stud-r"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_pouch_stud_r_31);
  const endpoint_nose_32 = makeAttachmentEndpoint(null);
  const node_nose_32 = new THREE.Group();
  node_nose_32.name = "Nose__pivot";
  node_nose_32.scale.set(1, 1, 1);
  if (endpoint_nose_32) {
    node_nose_32.position.copy(endpoint_nose_32.start);
    node_nose_32.rotation.set(0, 0, 0);
  } else {
    node_nose_32.position.set(0, -0.035, 0.256);
    node_nose_32.rotation.set(0, 0, 0);
  }
  node_nose_32.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["head"] ?? root).add(node_nose_32);
  nodes["nose"] = node_nose_32;
  const mesh_nose_32Geometry = endpoint_nose_32 ? new THREE.CylinderGeometry(endpoint_nose_32.endRadius, endpoint_nose_32.baseRadius, endpoint_nose_32.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_nose_32) {
    mesh_nose_32Geometry.scale(0.062, 0.042, 0.036);
  }
  const mesh_nose_32 = new THREE.Mesh(
    mesh_nose_32Geometry,
    materialMap["nose"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_nose_32.name = "Nose";
  if (endpoint_nose_32) {
    mesh_nose_32.position.copy(endpoint_nose_32.midpoint);
    mesh_nose_32.quaternion.copy(endpoint_nose_32.quaternion);
  }
  mesh_nose_32.castShadow = options.castShadow ?? true;
  mesh_nose_32.receiveShadow = options.receiveShadow ?? true;
  node_nose_32.add(mesh_nose_32);
  meshes["nose"] = mesh_nose_32;
  colliders["nose"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_nose_32);
  const endpoint_mouth_33 = makeAttachmentEndpoint(null);
  const node_mouth_33 = new THREE.Group();
  node_mouth_33.name = "Mouth__pivot";
  node_mouth_33.scale.set(1, 1, 1);
  if (endpoint_mouth_33) {
    node_mouth_33.position.copy(endpoint_mouth_33.start);
    node_mouth_33.rotation.set(0, 0, 0);
  } else {
    node_mouth_33.position.set(0, -0.1, 0.2378);
    node_mouth_33.rotation.set(0, 0, 0);
  }
  node_mouth_33.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["head"] ?? root).add(node_mouth_33);
  nodes["mouth"] = node_mouth_33;
  const mesh_mouth_33Geometry = endpoint_mouth_33 ? new THREE.CylinderGeometry(endpoint_mouth_33.endRadius, endpoint_mouth_33.baseRadius, endpoint_mouth_33.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_mouth_33) {
    mesh_mouth_33Geometry.scale(0.135, 0.062, 0.035);
  }
  const mesh_mouth_33 = new THREE.Mesh(
    mesh_mouth_33Geometry,
    materialMap["mouth"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_mouth_33.name = "Mouth";
  if (endpoint_mouth_33) {
    mesh_mouth_33.position.copy(endpoint_mouth_33.midpoint);
    mesh_mouth_33.quaternion.copy(endpoint_mouth_33.quaternion);
  }
  mesh_mouth_33.castShadow = options.castShadow ?? true;
  mesh_mouth_33.receiveShadow = options.receiveShadow ?? true;
  node_mouth_33.add(mesh_mouth_33);
  meshes["mouth"] = mesh_mouth_33;
  colliders["mouth"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_mouth_33);
  const endpoint_tongue_34 = makeAttachmentEndpoint(null);
  const node_tongue_34 = new THREE.Group();
  node_tongue_34.name = "Tongue__pivot";
  node_tongue_34.scale.set(1, 1, 1);
  if (endpoint_tongue_34) {
    node_tongue_34.position.copy(endpoint_tongue_34.start);
    node_tongue_34.rotation.set(0, 0, 0);
  } else {
    node_tongue_34.position.set(0, -0.012, 9e-3);
    node_tongue_34.rotation.set(0, 0, 0);
  }
  node_tongue_34.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["mouth"] ?? root).add(node_tongue_34);
  nodes["tongue"] = node_tongue_34;
  const mesh_tongue_34Geometry = endpoint_tongue_34 ? new THREE.CylinderGeometry(endpoint_tongue_34.endRadius, endpoint_tongue_34.baseRadius, endpoint_tongue_34.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_tongue_34) {
    mesh_tongue_34Geometry.scale(0.075, 0.034, 0.026);
  }
  const mesh_tongue_34 = new THREE.Mesh(
    mesh_tongue_34Geometry,
    materialMap["tongue"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_tongue_34.name = "Tongue";
  if (endpoint_tongue_34) {
    mesh_tongue_34.position.copy(endpoint_tongue_34.midpoint);
    mesh_tongue_34.quaternion.copy(endpoint_tongue_34.quaternion);
  }
  mesh_tongue_34.castShadow = options.castShadow ?? true;
  mesh_tongue_34.receiveShadow = options.receiveShadow ?? true;
  node_tongue_34.add(mesh_tongue_34);
  meshes["tongue"] = mesh_tongue_34;
  colliders["tongue"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_tongue_34);
  const endpoint_bandana_collar_35 = makeAttachmentEndpoint(null);
  const node_bandana_collar_35 = new THREE.Group();
  node_bandana_collar_35.name = "Bandana collar__pivot";
  node_bandana_collar_35.scale.set(1, 1, 1);
  if (endpoint_bandana_collar_35) {
    node_bandana_collar_35.position.copy(endpoint_bandana_collar_35.start);
    node_bandana_collar_35.rotation.set(1.5708, 0, 0);
  } else {
    node_bandana_collar_35.position.set(0, 0.228, -0.02);
    node_bandana_collar_35.rotation.set(1.5708, 0, 0);
  }
  node_bandana_collar_35.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_bandana_collar_35);
  nodes["bandana-collar"] = node_bandana_collar_35;
  const mesh_bandana_collar_35Geometry = endpoint_bandana_collar_35 ? new THREE.CylinderGeometry(endpoint_bandana_collar_35.endRadius, endpoint_bandana_collar_35.baseRadius, endpoint_bandana_collar_35.length, 32, 12) : new THREE.TorusGeometry(0.45, 0.08, 24, 96);
  if (!endpoint_bandana_collar_35) {
    mesh_bandana_collar_35Geometry.scale(0.47, 0.4, 0.42);
  }
  const mesh_bandana_collar_35 = new THREE.Mesh(
    mesh_bandana_collar_35Geometry,
    materialMap["bandana"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_bandana_collar_35.name = "Bandana collar";
  if (endpoint_bandana_collar_35) {
    mesh_bandana_collar_35.position.copy(endpoint_bandana_collar_35.midpoint);
    mesh_bandana_collar_35.quaternion.copy(endpoint_bandana_collar_35.quaternion);
  }
  mesh_bandana_collar_35.castShadow = options.castShadow ?? true;
  mesh_bandana_collar_35.receiveShadow = options.receiveShadow ?? true;
  node_bandana_collar_35.add(mesh_bandana_collar_35);
  meshes["bandana-collar"] = mesh_bandana_collar_35;
  colliders["bandana-collar"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_bandana_collar_35);
  const endpoint_bandana_front_36 = makeAttachmentEndpoint(null);
  const node_bandana_front_36 = new THREE.Group();
  node_bandana_front_36.name = "Bandana triangle__pivot";
  node_bandana_front_36.scale.set(1, 1, 1);
  if (endpoint_bandana_front_36) {
    node_bandana_front_36.position.copy(endpoint_bandana_front_36.start);
    node_bandana_front_36.rotation.set(0.27925, 0, 0);
  } else {
    node_bandana_front_36.position.set(0, 0.262, 0.2);
    node_bandana_front_36.rotation.set(0.27925, 0, 0);
  }
  node_bandana_front_36.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_bandana_front_36);
  nodes["bandana-front"] = node_bandana_front_36;
  const mesh_bandana_front_36Geometry = endpoint_bandana_front_36 ? new THREE.CylinderGeometry(endpoint_bandana_front_36.endRadius, endpoint_bandana_front_36.baseRadius, endpoint_bandana_front_36.length, 32, 12) : buildExtrudeGeometry({ "points": [[-0.25, 0], [-0.17, -0.055], [-0.09, -0.115], [-0.03, -0.165], [0, -0.18], [0.03, -0.165], [0.09, -0.115], [0.17, -0.055], [0.25, 0], [0, 0.03]], "depth": 0.022 });
  if (!endpoint_bandana_front_36) {
    mesh_bandana_front_36Geometry.scale(1, 1, 1);
  }
  const mesh_bandana_front_36 = new THREE.Mesh(
    mesh_bandana_front_36Geometry,
    materialMap["bandana"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_bandana_front_36.name = "Bandana triangle";
  if (endpoint_bandana_front_36) {
    mesh_bandana_front_36.position.copy(endpoint_bandana_front_36.midpoint);
    mesh_bandana_front_36.quaternion.copy(endpoint_bandana_front_36.quaternion);
  }
  mesh_bandana_front_36.castShadow = options.castShadow ?? true;
  mesh_bandana_front_36.receiveShadow = options.receiveShadow ?? true;
  node_bandana_front_36.add(mesh_bandana_front_36);
  meshes["bandana-front"] = mesh_bandana_front_36;
  colliders["bandana-front"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_bandana_front_36);
  const endpoint_bandana_knot_37 = makeAttachmentEndpoint(null);
  const node_bandana_knot_37 = new THREE.Group();
  node_bandana_knot_37.name = "Bandana knot__pivot";
  node_bandana_knot_37.scale.set(1, 1, 1);
  if (endpoint_bandana_knot_37) {
    node_bandana_knot_37.position.copy(endpoint_bandana_knot_37.start);
    node_bandana_knot_37.rotation.set(0, 0, 0);
  } else {
    node_bandana_knot_37.position.set(0.255, 0.255, 0.06);
    node_bandana_knot_37.rotation.set(0, 0, 0);
  }
  node_bandana_knot_37.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_bandana_knot_37);
  nodes["bandana-knot"] = node_bandana_knot_37;
  const mesh_bandana_knot_37Geometry = endpoint_bandana_knot_37 ? new THREE.CylinderGeometry(endpoint_bandana_knot_37.endRadius, endpoint_bandana_knot_37.baseRadius, endpoint_bandana_knot_37.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_bandana_knot_37) {
    mesh_bandana_knot_37Geometry.scale(0.085, 0.08, 0.08);
  }
  const mesh_bandana_knot_37 = new THREE.Mesh(
    mesh_bandana_knot_37Geometry,
    materialMap["bandana"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_bandana_knot_37.name = "Bandana knot";
  if (endpoint_bandana_knot_37) {
    mesh_bandana_knot_37.position.copy(endpoint_bandana_knot_37.midpoint);
    mesh_bandana_knot_37.quaternion.copy(endpoint_bandana_knot_37.quaternion);
  }
  mesh_bandana_knot_37.castShadow = options.castShadow ?? true;
  mesh_bandana_knot_37.receiveShadow = options.receiveShadow ?? true;
  node_bandana_knot_37.add(mesh_bandana_knot_37);
  meshes["bandana-knot"] = mesh_bandana_knot_37;
  colliders["bandana-knot"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_bandana_knot_37);
  const endpoint_bandana_tail_38 = makeAttachmentEndpoint(null);
  const node_bandana_tail_38 = new THREE.Group();
  node_bandana_tail_38.name = "Bandana knot tail__pivot";
  node_bandana_tail_38.scale.set(1, 1, 1);
  if (endpoint_bandana_tail_38) {
    node_bandana_tail_38.position.copy(endpoint_bandana_tail_38.start);
    node_bandana_tail_38.rotation.set(0, 0, -0.34907);
  } else {
    node_bandana_tail_38.position.set(0.04, 0, 0);
    node_bandana_tail_38.rotation.set(0, 0, -0.34907);
  }
  node_bandana_tail_38.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["bandana-knot"] ?? root).add(node_bandana_tail_38);
  nodes["bandana-tail"] = node_bandana_tail_38;
  const mesh_bandana_tail_38Geometry = endpoint_bandana_tail_38 ? new THREE.CylinderGeometry(endpoint_bandana_tail_38.endRadius, endpoint_bandana_tail_38.baseRadius, endpoint_bandana_tail_38.length, 32, 12) : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_bandana_tail_38) {
    mesh_bandana_tail_38Geometry.scale(0.07, 0.04, 0.015);
  }
  const mesh_bandana_tail_38 = new THREE.Mesh(
    mesh_bandana_tail_38Geometry,
    materialMap["bandana"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_bandana_tail_38.name = "Bandana knot tail";
  if (endpoint_bandana_tail_38) {
    mesh_bandana_tail_38.position.copy(endpoint_bandana_tail_38.midpoint);
    mesh_bandana_tail_38.quaternion.copy(endpoint_bandana_tail_38.quaternion);
  }
  mesh_bandana_tail_38.castShadow = options.castShadow ?? true;
  mesh_bandana_tail_38.receiveShadow = options.receiveShadow ?? true;
  node_bandana_tail_38.add(mesh_bandana_tail_38);
  meshes["bandana-tail"] = mesh_bandana_tail_38;
  colliders["bandana-tail"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_bandana_tail_38);
  const endpoint_neck_39 = makeAttachmentEndpoint(null);
  const node_neck_39 = new THREE.Group();
  node_neck_39.name = "Neck filler__pivot";
  node_neck_39.scale.set(1, 1, 1);
  if (endpoint_neck_39) {
    node_neck_39.position.copy(endpoint_neck_39.start);
    node_neck_39.rotation.set(0, 0, 0);
  } else {
    node_neck_39.position.set(0, 0.235, -0.01);
    node_neck_39.rotation.set(0, 0, 0);
  }
  node_neck_39.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_neck_39);
  nodes["neck"] = node_neck_39;
  const mesh_neck_39Geometry = endpoint_neck_39 ? new THREE.CylinderGeometry(endpoint_neck_39.endRadius, endpoint_neck_39.baseRadius, endpoint_neck_39.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_neck_39) {
    mesh_neck_39Geometry.scale(0.42, 0.16, 0.38);
  }
  const mesh_neck_39 = new THREE.Mesh(
    mesh_neck_39Geometry,
    materialMap["fur-orange"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_neck_39.name = "Neck filler";
  if (endpoint_neck_39) {
    mesh_neck_39.position.copy(endpoint_neck_39.midpoint);
    mesh_neck_39.quaternion.copy(endpoint_neck_39.quaternion);
  }
  mesh_neck_39.castShadow = options.castShadow ?? true;
  mesh_neck_39.receiveShadow = options.receiveShadow ?? true;
  node_neck_39.add(mesh_neck_39);
  meshes["neck"] = mesh_neck_39;
  colliders["neck"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_neck_39);
  const endpoint_belt_40 = makeAttachmentEndpoint(null);
  const node_belt_40 = new THREE.Group();
  node_belt_40.name = "Belt strap__pivot";
  node_belt_40.scale.set(1, 1, 1);
  if (endpoint_belt_40) {
    node_belt_40.position.copy(endpoint_belt_40.start);
    node_belt_40.rotation.set(1.5708, 0, 0);
  } else {
    node_belt_40.position.set(0, -0.085, 0);
    node_belt_40.rotation.set(1.5708, 0, 0);
  }
  node_belt_40.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_belt_40);
  nodes["belt"] = node_belt_40;
  const mesh_belt_40Geometry = endpoint_belt_40 ? new THREE.CylinderGeometry(endpoint_belt_40.endRadius, endpoint_belt_40.baseRadius, endpoint_belt_40.length, 32, 12) : new THREE.TorusGeometry(0.45, 0.08, 24, 96);
  if (!endpoint_belt_40) {
    mesh_belt_40Geometry.scale(0.585, 0.535, 0.45);
  }
  const mesh_belt_40 = new THREE.Mesh(
    mesh_belt_40Geometry,
    materialMap["leather"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_belt_40.name = "Belt strap";
  if (endpoint_belt_40) {
    mesh_belt_40.position.copy(endpoint_belt_40.midpoint);
    mesh_belt_40.quaternion.copy(endpoint_belt_40.quaternion);
  }
  mesh_belt_40.castShadow = options.castShadow ?? true;
  mesh_belt_40.receiveShadow = options.receiveShadow ?? true;
  node_belt_40.add(mesh_belt_40);
  meshes["belt"] = mesh_belt_40;
  colliders["belt"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_belt_40);
  const endpoint_buckle_41 = makeAttachmentEndpoint(null);
  const node_buckle_41 = new THREE.Group();
  node_buckle_41.name = "Belt buckle__pivot";
  node_buckle_41.scale.set(1, 1, 1);
  if (endpoint_buckle_41) {
    node_buckle_41.position.copy(endpoint_buckle_41.start);
    node_buckle_41.rotation.set(0, 0, 0);
  } else {
    node_buckle_41.position.set(0, -0.085, 0.274);
    node_buckle_41.rotation.set(0, 0, 0);
  }
  node_buckle_41.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_buckle_41);
  nodes["buckle"] = node_buckle_41;
  const mesh_buckle_41Geometry = endpoint_buckle_41 ? new THREE.CylinderGeometry(endpoint_buckle_41.endRadius, endpoint_buckle_41.baseRadius, endpoint_buckle_41.length, 32, 12) : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_buckle_41) {
    mesh_buckle_41Geometry.scale(0.078, 0.066, 0.02);
  }
  const mesh_buckle_41 = new THREE.Mesh(
    mesh_buckle_41Geometry,
    materialMap["brass"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_buckle_41.name = "Belt buckle";
  if (endpoint_buckle_41) {
    mesh_buckle_41.position.copy(endpoint_buckle_41.midpoint);
    mesh_buckle_41.quaternion.copy(endpoint_buckle_41.quaternion);
  }
  mesh_buckle_41.castShadow = options.castShadow ?? true;
  mesh_buckle_41.receiveShadow = options.receiveShadow ?? true;
  node_buckle_41.add(mesh_buckle_41);
  meshes["buckle"] = mesh_buckle_41;
  colliders["buckle"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_buckle_41);
  const endpoint_buckle_hole_42 = makeAttachmentEndpoint(null);
  const node_buckle_hole_42 = new THREE.Group();
  node_buckle_hole_42.name = "Buckle opening__pivot";
  node_buckle_hole_42.scale.set(1, 1, 1);
  if (endpoint_buckle_hole_42) {
    node_buckle_hole_42.position.copy(endpoint_buckle_hole_42.start);
    node_buckle_hole_42.rotation.set(0, 0, 0);
  } else {
    node_buckle_hole_42.position.set(0, 0, 6e-3);
    node_buckle_hole_42.rotation.set(0, 0, 0);
  }
  node_buckle_hole_42.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["buckle"] ?? root).add(node_buckle_hole_42);
  nodes["buckle-hole"] = node_buckle_hole_42;
  const mesh_buckle_hole_42Geometry = endpoint_buckle_hole_42 ? new THREE.CylinderGeometry(endpoint_buckle_hole_42.endRadius, endpoint_buckle_hole_42.baseRadius, endpoint_buckle_hole_42.length, 32, 12) : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_buckle_hole_42) {
    mesh_buckle_hole_42Geometry.scale(0.045, 0.03, 0.012);
  }
  const mesh_buckle_hole_42 = new THREE.Mesh(
    mesh_buckle_hole_42Geometry,
    materialMap["leather"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_buckle_hole_42.name = "Buckle opening";
  if (endpoint_buckle_hole_42) {
    mesh_buckle_hole_42.position.copy(endpoint_buckle_hole_42.midpoint);
    mesh_buckle_hole_42.quaternion.copy(endpoint_buckle_hole_42.quaternion);
  }
  mesh_buckle_hole_42.castShadow = options.castShadow ?? true;
  mesh_buckle_hole_42.receiveShadow = options.receiveShadow ?? true;
  node_buckle_hole_42.add(mesh_buckle_hole_42);
  meshes["buckle-hole"] = mesh_buckle_hole_42;
  colliders["buckle-hole"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_buckle_hole_42);
  const endpoint_tail_43 = makeAttachmentEndpoint(null);
  const node_tail_43 = new THREE.Group();
  node_tail_43.name = "Curled tail (inferred)__pivot";
  node_tail_43.scale.set(1, 1, 1);
  if (endpoint_tail_43) {
    node_tail_43.position.copy(endpoint_tail_43.start);
    node_tail_43.rotation.set(0, 0, 0);
  } else {
    node_tail_43.position.set(0, 0.07, -0.25);
    node_tail_43.rotation.set(0, 0, 0);
  }
  node_tail_43.userData.actionProfile = { "animationRole": "rotate", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["torso"] ?? root).add(node_tail_43);
  nodes["tail"] = node_tail_43;
  const mesh_tail_43Geometry = endpoint_tail_43 ? new THREE.CylinderGeometry(endpoint_tail_43.endRadius, endpoint_tail_43.baseRadius, endpoint_tail_43.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_tail_43) {
    mesh_tail_43Geometry.scale(0.17, 0.17, 0.13);
  }
  const mesh_tail_43 = new THREE.SkinnedMesh(
    mesh_tail_43Geometry,
    materialMap["fur-orange"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_tail_43.name = "Curled tail (inferred)";
  if (endpoint_tail_43) {
    mesh_tail_43.position.copy(endpoint_tail_43.midpoint);
    mesh_tail_43.quaternion.copy(endpoint_tail_43.quaternion);
  }
  mesh_tail_43.castShadow = options.castShadow ?? true;
  mesh_tail_43.receiveShadow = options.receiveShadow ?? true;
  node_tail_43.add(mesh_tail_43);
  meshes["tail"] = mesh_tail_43;
  colliders["tail"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_tail_43);
  const endpoint_tail_tip_44 = makeAttachmentEndpoint(null);
  const node_tail_tip_44 = new THREE.Group();
  node_tail_tip_44.name = "Tail cream curl (inferred)__pivot";
  node_tail_tip_44.scale.set(1, 1, 1);
  if (endpoint_tail_tip_44) {
    node_tail_tip_44.position.copy(endpoint_tail_tip_44.start);
    node_tail_tip_44.rotation.set(0, 0, 0);
  } else {
    node_tail_tip_44.position.set(0, 0.02, -0.045);
    node_tail_tip_44.rotation.set(0, 0, 0);
  }
  node_tail_tip_44.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin" } };
  (nodes["tail"] ?? root).add(node_tail_tip_44);
  nodes["tail-tip"] = node_tail_tip_44;
  const mesh_tail_tip_44Geometry = endpoint_tail_tip_44 ? new THREE.CylinderGeometry(endpoint_tail_tip_44.endRadius, endpoint_tail_tip_44.baseRadius, endpoint_tail_tip_44.length, 32, 12) : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_tail_tip_44) {
    mesh_tail_tip_44Geometry.scale(0.09, 0.09, 0.06);
  }
  const mesh_tail_tip_44 = new THREE.Mesh(
    mesh_tail_tip_44Geometry,
    materialMap["fur-cream"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_tail_tip_44.name = "Tail cream curl (inferred)";
  if (endpoint_tail_tip_44) {
    mesh_tail_tip_44.position.copy(endpoint_tail_tip_44.midpoint);
    mesh_tail_tip_44.quaternion.copy(endpoint_tail_tip_44.quaternion);
  }
  mesh_tail_tip_44.castShadow = options.castShadow ?? true;
  mesh_tail_tip_44.receiveShadow = options.receiveShadow ?? true;
  node_tail_tip_44.add(mesh_tail_tip_44);
  meshes["tail-tip"] = mesh_tail_tip_44;
  colliders["tail-tip"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy" };
  destructionGroups["head"] ?? (destructionGroups["head"] = []);
  destructionGroups["head"].push(node_tail_tip_44);
  const bones = {};
  const boneOrder = [];
  const bone_root = new THREE.Bone();
  bone_root.name = "root";
  bone_root.position.set(0, 0, 0);
  root.add(bone_root);
  bones["root"] = bone_root;
  boneOrder.push("root");
  const bone_torso = new THREE.Bone();
  bone_torso.name = "torso";
  bone_torso.position.set(0, 0.315, 0);
  bone_root.add(bone_torso);
  bones["torso"] = bone_torso;
  boneOrder.push("torso");
  const bone_head = new THREE.Bone();
  bone_head.name = "head";
  bone_head.position.set(0, 0.41, 0.02);
  bone_torso.add(bone_head);
  bones["head"] = bone_head;
  boneOrder.push("head");
  const bone_tail = new THREE.Bone();
  bone_tail.name = "tail";
  bone_tail.position.set(0, 0.07, -0.25);
  bone_torso.add(bone_tail);
  bones["tail"] = bone_tail;
  boneOrder.push("tail");
  const bone_arm_l = new THREE.Bone();
  bone_arm_l.name = "arm-l";
  bone_arm_l.position.set(0.255, 0.2, 0.02);
  bone_torso.add(bone_arm_l);
  bones["arm-l"] = bone_arm_l;
  boneOrder.push("arm-l");
  const bone_leg_l = new THREE.Bone();
  bone_leg_l.name = "leg-l";
  bone_leg_l.position.set(0.13, -0.13, 0);
  bone_torso.add(bone_leg_l);
  bones["leg-l"] = bone_leg_l;
  boneOrder.push("leg-l");
  const bone_arm_r = new THREE.Bone();
  bone_arm_r.name = "arm-r";
  bone_arm_r.position.set(-0.255, 0.2, 0.02);
  bone_torso.add(bone_arm_r);
  bones["arm-r"] = bone_arm_r;
  boneOrder.push("arm-r");
  const bone_leg_r = new THREE.Bone();
  bone_leg_r.name = "leg-r";
  bone_leg_r.position.set(-0.13, -0.13, 0);
  bone_torso.add(bone_leg_r);
  bones["leg-r"] = bone_leg_r;
  boneOrder.push("leg-r");
  const bone_ear_l = new THREE.Bone();
  bone_ear_l.name = "ear-l";
  bone_ear_l.position.set(0.145, 0.11499999999999999, -0.03);
  bone_head.add(bone_ear_l);
  bones["ear-l"] = bone_ear_l;
  boneOrder.push("ear-l");
  const bone_ear_r = new THREE.Bone();
  bone_ear_r.name = "ear-r";
  bone_ear_r.position.set(-0.145, 0.11499999999999999, -0.03);
  bone_head.add(bone_ear_r);
  bones["ear-r"] = bone_ear_r;
  boneOrder.push("ear-r");
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(boneOrder.map((id) => bones[id]));
  const boneIndexOf = new Map(boneOrder.map((id, i) => [id, i]));
  const BONE_JOINT = { "root": [0, 0, 0], "torso": [0, 0.315, 0], "head": [0, 0.725, 0.02], "tail": [0, 0.385, -0.25], "arm-l": [0.255, 0.515, 0.02], "leg-l": [0.13, 0.185, 0], "arm-r": [-0.255, 0.515, 0.02], "leg-r": [-0.13, 0.185, 0], "ear-l": [0.145, 0.84, -0.01], "ear-r": [-0.145, 0.84, -0.01] };
  const BONE_TIP = { "root": [0, 0.315, 0], "torso": [0, 0.5549999999999999, 0], "head": [0, 1, 0.02], "tail": [0, 0.485, -0.3], "arm-l": [0.395, 0.355, 0.06], "leg-l": [0.13, 0.045, 0.02], "arm-r": [-0.395, 0.355, 0.06], "leg-r": [-0.13, 0.045, 0.02], "ear-l": [0.175, 0.97, -0.01], "ear-r": [-0.175, 0.97, -0.01] };
  const BONE_ENVELOPE = { "root": 0.6, "torso": 0.378, "head": 0.318, "tail": 0.102, "arm-l": 0.066, "leg-l": 0.084, "arm-r": 0.066, "leg-r": 0.084, "ear-l": 0.6, "ear-r": 0.6 };
  const _closest = new THREE.Vector3();
  const distanceToSegment = (p, s, e) => {
    const ab = [e[0] - s[0], e[1] - s[1], e[2] - s[2]];
    const ap = [p.x - s[0], p.y - s[1], p.z - s[2]];
    const abLenSq = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    const t = abLenSq > 1e-12 ? THREE.MathUtils.clamp((ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / abLenSq, 0, 1) : 0;
    _closest.set(s[0] + ab[0] * t, s[1] + ab[1] * t, s[2] + ab[2] * t);
    return p.distanceTo(_closest);
  };
  const computeVertexWeights = (p) => {
    const scored = boneOrder.map((id) => {
      const d = distanceToSegment(p, BONE_JOINT[id], BONE_TIP[id]);
      const u = d / BONE_ENVELOPE[id];
      const falloff = Math.max(0, 1 - u * u);
      return { id, d, w: falloff * falloff };
    });
    scored.sort((a, b) => b.w - a.w);
    const kept = scored.slice(0, 4);
    const total = kept.reduce((sum, c) => sum + c.w, 0);
    const indices = [0, 0, 0, 0];
    const weights = [0, 0, 0, 0];
    if (total > 0) {
      for (let slot = 0; slot < kept.length; slot++) {
        indices[slot] = boneIndexOf.get(kept[slot].id) ?? 0;
        weights[slot] = kept[slot].w / total;
      }
      return { indices, weights, fallback: false };
    }
    let nearest = boneOrder[0];
    let nearestDistance = Infinity;
    for (const id of boneOrder) {
      const d = distanceToSegment(p, BONE_JOINT[id], BONE_TIP[id]);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = id;
      }
    }
    indices[0] = boneIndexOf.get(nearest) ?? 0;
    weights[0] = 1;
    return { indices, weights, fallback: true };
  };
  nodes["ear-l"]?.rotation.set(0, 0, 0);
  nodes["ear-r"]?.rotation.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const skinnedMeshNames = [];
  let boundCount = 0;
  for (const boneId of boneOrder) {
    const mesh = meshes[boneId];
    if (!mesh) continue;
    const position = mesh.geometry.getAttribute("position");
    if (!position) continue;
    mesh.updateWorldMatrix(true, false);
    if (mesh.geometry.userData.worldBaked) {
      throw new Error(
        `geometry for '${boneId}' is already world-baked; baking twice squares the world matrix and scatters the parts. Build a fresh factory instead of re-binding.`
      );
    }
    mesh.geometry.applyMatrix4(mesh.matrixWorld);
    mesh.geometry.userData.worldBaked = true;
    root.add(mesh);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.updateMatrixWorld(true);
    const count = position.count;
    const skinIndices = new Uint16Array(count * 4);
    const skinWeights = new Float32Array(count * 4);
    const vertex = new THREE.Vector3();
    for (let v = 0; v < count; v++) {
      vertex.fromBufferAttribute(position, v);
      const { indices, weights } = computeVertexWeights(vertex);
      for (let slot = 0; slot < 4; slot++) {
        skinIndices[v * 4 + slot] = indices[slot];
        skinWeights[v * 4 + slot] = weights[slot];
      }
    }
    mesh.geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
    mesh.geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
    skinnedMeshNames.push(boneId);
    const skinned = mesh;
    if (!skinned.isSkinnedMesh) continue;
    skinned.bind(skeleton, new THREE.Matrix4());
    skinned.frustumCulled = false;
    boundCount += 1;
  }
  nodes["ear-l"]?.rotation.set(-0.13963, 0, -0.24435);
  nodes["ear-r"]?.rotation.set(-0.13963, 0, 0.24435);
  root.updateMatrixWorld(true);
  bone_ear_l.rotation.set(-0.13963, 0, -0.24435);
  bone_ear_r.rotation.set(-0.13963, 0, 0.24435);
  root.updateMatrixWorld(true);
  skeleton.update();
  root.userData.rig = { bones, skeleton, boneOrder, boneIndexOf, skinAttributes: skinnedMeshNames, bound: skinnedMeshNames.length > 0 && boundCount === skinnedMeshNames.length, frustumCulled: false, cullingNote: "skinned meshes set frustumCulled = false; bone motion does not update a SkinnedMesh boundingSphere, so a consumer that needs culling must recompute bounds per frame" };
  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups };
  root.userData.actionReadiness = {
    note: "Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets."
  };
  return root;
}
export {
  createChibiShibaMascotModel as createShibaModel
};
