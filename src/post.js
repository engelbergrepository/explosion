import * as THREE from 'three/webgpu';
import { pass, uniform, vec2, vec3, vec4, float, mix, screenUV, length, pow } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js';

export function createPost(renderer, scene, camera) {
  const uFocus = uniform(8000);
  const uRange = uniform(2500);
  const uBokeh = uniform(3);
  const uGrain = uniform(0.45);
  const uFlash = uniform(0);
  const uBW = uniform(0);
  const uWarm = uniform(0.35);
  const uExposure = uniform(1);
  const uVignette = uniform(0.35);

  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode('output');
  const flashed = color.add(vec4(vec3(1, 0.96, 0.9).mul(uFlash), 0));
  const bloomed = flashed.add(bloom(flashed, 0.85, 0.55, 0.78));
  const focused = dof(bloomed, scenePass.getViewZNode(), uFocus, uRange, uBokeh);
  const grained = film(focused, uGrain);
  const fringed = chromaticAberration(grained, float(0.0016), vec2(0.5, 0.5), float(1.02));

  const rgb = fringed.rgb.mul(uExposure);
  const luma = rgb.x.mul(0.299).add(rgb.y.mul(0.587)).add(rgb.z.mul(0.114));
  const toned = mix(rgb, vec3(luma), uBW);
  const warmed = toned.mul(mix(vec3(1, 1, 1), vec3(1.08, 0.95, 0.82), uWarm));
  const vig = float(1).sub(pow(length(screenUV.sub(0.5)).mul(1.15), float(2)).mul(uVignette));
  pipeline.outputNode = vec4(warmed.mul(vig), 1);

  return { pipeline, uFocus, uRange, uBokeh, uGrain, uFlash, uBW, uWarm, uExposure, uVignette };
}
