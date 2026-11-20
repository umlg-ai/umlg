import * as THREE from 'three';

export type WorldMode = 'M' | 'R';

/** 1. CORE UMLG: Универсальные сущности, независимые от домена */
export type CoreEntityKind =
  | 'Class'          // Модуль с состоянием и поведением
  | 'AbstractClass'  // Неполный каркас / шаблон
  | 'Interface'      // Контракт / точка стыковки
  | 'Struct'         // Пассивная структура данных
  | 'Enum'           // Конечный набор состояний
  | 'Process'        // Активный узел обработки / функция
  | 'Store'          // Абстрактное хранилище / память
  | 'Channel';       // Шина / очередь сообщений

export type CoreLinkKind =
  | 'Inheritance'
  | 'Composition'
  | 'DataFlow'
  | 'ControlFlow'
  | 'Dependency';

export interface ThemeContext {
  world: WorldMode;
  phaseProgress: number;
  selected?: boolean;
  hovered?: boolean;
  meta?: Record<string, unknown>;
}

export interface ThemeEnvironment {
  backgroundColor: number;
  fogColor: number;
  fogDensity: number;
  gridPrimaryColor: number;
  gridSecondaryColor: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  /** Необязательные переопределения света; иначе действуют значения по миру. */
  ambientIntensity?: number;
  keyIntensity?: number;
  rimIntensity?: number;
  rimColor?: number;
  showGrid?: boolean;
}

export interface ThemeDefinition {
  id: string;
  label: string;
  description?: string;
  /**
   * Доменные профили, которые поставляет тема. ThemeManager включает их
   * вместе с темой и сохраняет выбор пользователя при переключении.
   */
  plugins?: VisualProfilePlugin[];
  /** Тема сама рисует миниатюру R-двойника внутри M-класса. */
  rendersPreview?: boolean;
  getEnvironment(world: WorldMode): ThemeEnvironment;
  createEntityObject(kind: CoreEntityKind, ctx: ThemeContext): THREE.Group;
  updateEntityObject?(group: THREE.Group, kind: CoreEntityKind, ctx: ThemeContext, elapsed: number): void;
  createLinkObject?(kind: CoreLinkKind, points: THREE.Vector3[], ctx: ThemeContext): THREE.Group;
  updateLinkObject?(group: THREE.Group, kind: CoreLinkKind, ctx: ThemeContext, elapsed: number): void;
}

/** 2. PLUGIN INTERFACE: Контракт для подключаемых доменных расширений */
export interface VisualProfilePlugin {
  /** Уникальный ID профиля, например: "graphics-gpu" или "web-backend" */
  profileId: string;
  label: string;
  /** Список типов сущностей, которые обслуживает этот плагин (например, "gpu:ShaderStage") */
  supportedKinds: string[];
  createEntityObject(kind: string, ctx: ThemeContext): THREE.Group | null;
  updateEntityObject?(group: THREE.Group, kind: string, ctx: ThemeContext, elapsed: number): void;
  createLinkObject?(kind: string, points: THREE.Vector3[], ctx: ThemeContext): THREE.Group | null;
  updateLinkObject?(group: THREE.Group, kind: string, ctx: ThemeContext, elapsed: number): void;
}
