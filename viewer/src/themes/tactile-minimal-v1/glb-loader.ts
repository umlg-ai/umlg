import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TactileMaterials } from './materials';

const loader = new GLTFLoader();
const modelCache = new Map<string, Promise<THREE.Group>>();

// Карта соответствия visualKind -> файл в tactile_glb/
export const KIND_TO_GLB: Record<string, string> = {
  // M-мир
  class: 'class.glb',
  abstractClass: 'abstract_class.glb',
  interface: 'interface.glb',
  component: 'component.glb',
  concept: 'concept.glb',

  // R-мир
  object: 'object.glb',
  resource: 'resource.glb',
  process: 'process.glb',
  stage: 'stage.glb',
  command: 'command.glb',
  actor: 'actor.glb',
};

// Карта переопределения по тегам / плагину graphics-gpu
export const TAG_TO_GLB: Record<string, string> = {
  pipeline: 'vk_pipeline.glb',
  'pipeline-stage': 'vk_shader_stage.glb',
  buffer: 'vk_buffer.glb',
  framebuffer: 'vk_framebuffer.glb',
  'vertex-layout': 'vk_vertex_layout.glb',
  descriptor: 'vk_descriptor.glb',
  'command-queue': 'vk_command_queue.glb',
  texture: 'vk_texture.glb',
};

function fetchGlb(filename: string): Promise<THREE.Group> {
  if (!modelCache.has(filename)) {
    const url = new URL(`./tactile_glb/${filename}`, import.meta.url).href;
    const promise = loader.loadAsync(url).then((gltf) => {
      const root = gltf.scene;
      // Включаем тени для всех мешей модели
      root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return root;
    });
    modelCache.set(filename, promise);
  }
  return modelCache.get(filename)!;
}

/**
 * Клонирует загруженный GLB и применяет стиль M-мира (поликарбонат + ребра),
 * если модель рендерится как превью/чертеж.
 */
function prepareGlbInstance(
  source: THREE.Group,
  mats: TactileMaterials,
  isPreview: boolean,
): THREE.Group {
  const clone = source.clone(true);

  if (isPreview) {
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = mats.mWorldPolycarbonate;
        child.castShadow = false;
        child.receiveShadow = false;

        // Добавляем графитовый контур чертежа как в процедурных примитивах
        const edges = new THREE.EdgesGeometry(child.geometry, 25);
        const line = new THREE.LineSegments(edges, mats.mWorldWireframe);
        child.add(line);
      }
    });
  }

  return clone;
}

/**
 * Оборачивает процедурный фолбэк в контейнер и асинхронно заменяет его на GLB.
 */
export function loadGlbIntoGroup(
  filename: string,
  mats: TactileMaterials,
  fallbackGroup: THREE.Group,
  isPreview = false,
  onLoaded?: (loadedModel: THREE.Group) => void,
): THREE.Group {
  const container = new THREE.Group();
  container.add(fallbackGroup);

  fetchGlb(filename)
    .then((source) => {
      const instance = prepareGlbInstance(source, mats, isPreview);
      container.remove(fallbackGroup);
      container.add(instance);
      onLoaded?.(instance);
    })
    .catch((err) => {
      console.warn(`[tactile-minimal-v1] Не удалось загрузить ${filename}, оставлен процедурный меш:`, err);
    });

  return container;
}
