import type { Element, RelationKind } from '../core/types';
import type { CoreLinkKind } from './types';

export interface ResolvedEntity {
  kind: string;
  meta?: Record<string, unknown>;
}

export function resolveEntityKind(element: Element): ResolvedEntity {
  // 1. Прямой тег с префиксом доменного профиля (например, "gpu:Buffer")
  if (element.tags) {
    const gpuTag = element.tags.find((t) => t.startsWith('gpu:'));
    if (gpuTag) {
      return { kind: gpuTag };
    }
  }

  const name = element.name;
  const id = element.id.toLowerCase();

  // 2. Семантическое распознавание сущностей графического конвейера (Hello Triangle / OpenGL / Vulkan)
  if (
    name.includes('VBO') ||
    name.includes('EBO') ||
    name.includes('UBO') ||
    name.includes('VertexBuffer') ||
    name.includes('IndexBuffer') ||
    id.includes('.vbo') ||
    id.includes('.ebo')
  ) {
    return { kind: 'gpu:Buffer' };
  }

  if (
    name.includes('VAO') ||
    name.includes('VertexLayout') ||
    name.includes('VertexArray') ||
    id.includes('.vao')
  ) {
    return { kind: 'gpu:VertexLayout' };
  }

  if (name.includes('Fragment') || id.includes('fragment')) {
    return { kind: 'gpu:ShaderStage', meta: { stage: 'fragment' } };
  }

  if (name.includes('Compute') || id.includes('compute')) {
    return { kind: 'gpu:ShaderStage', meta: { stage: 'compute' } };
  }

  if (
    name.includes('VertexShader') ||
    name.includes('VertexStage') ||
    id.includes('vertexshader') ||
    id.includes('stage.vertex') ||
    (element.tags?.includes('pipeline-stage') && name.includes('Vertex'))
  ) {
    return { kind: 'gpu:ShaderStage', meta: { stage: 'vertex' } };
  }

  if (name.includes('Shader') || id.includes('shader')) {
    return { kind: 'gpu:ShaderStage', meta: { stage: 'vertex' } };
  }

  if (
    name.includes('GraphicsPipeline') ||
    name.includes('ShaderProgram') ||
    id.includes('pipeline') ||
    id.includes('program')
  ) {
    return { kind: 'gpu:Pipeline' };
  }

  if (
    name.includes('Framebuffer') ||
    name.includes('FBO') ||
    name.includes('Swapchain') ||
    id.includes('framebuffer')
  ) {
    return { kind: 'gpu:Framebuffer' };
  }

  if (
    name.includes('Draw') ||
    name.includes('Command') ||
    id.includes('.cmd.') ||
    id.includes('drawcall')
  ) {
    return { kind: 'gpu:CommandQueue' };
  }

  if (name.includes('Texture') || id.includes('texture')) {
    return { kind: 'gpu:Texture' };
  }

  if (name.includes('Descriptor') || name.includes('Uniform') || id.includes('uniform')) {
    return { kind: 'gpu:Descriptor' };
  }

  // 3. Базовый маппинг CoreEntityKind для ядра UMLG
  switch (element.kind) {
    case 'class':
      return { kind: 'Class' };
    case 'abstractClass':
      return { kind: 'AbstractClass' };
    case 'interface':
      return { kind: 'Interface' };
    case 'component':
      return { kind: 'Class' };
    case 'concept':
      return { kind: 'Struct' };
    case 'object':
      return { kind: 'Class' };
    case 'resource':
      return { kind: 'Store' };
    case 'process':
      return { kind: 'Process' };
    case 'stage':
      return { kind: 'Process' };
    case 'command':
      return { kind: 'Channel' };
    case 'actor':
      return { kind: 'Process' };
    default:
      return { kind: 'Process' };
  }
}

export function resolveLinkKind(relationKind: RelationKind): CoreLinkKind {
  switch (relationKind) {
    case 'inheritance':
    case 'realization':
      return 'Inheritance';
    case 'composition':
    case 'aggregation':
      return 'Composition';
    case 'flow':
      return 'DataFlow';
    case 'call':
    case 'signal':
      return 'ControlFlow';
    case 'binding':
    case 'dependency':
    case 'association':
    default:
      return 'Dependency';
  }
}
