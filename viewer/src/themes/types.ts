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

/** 2. PLUGIN INTERFACE: Контракт для подключаемых доменных расширений */
export interface VisualProfilePlugin {
  /** Уникальный ID профиля, например: "graphics-gpu" или "web-backend" */
  profileId: string;
  label: string;
  /** Список типов сущностей, которые обслуживает этот плагин (например, "gpu:ShaderStage") */
  supportedKinds: string[];
  createEntityObject(kind: string, ctx: ThemeContext): THREE.Group | null;
  updateEntityObject?(group: THREE.Group, kind: string, ctx: ThemeContext, elapsed: number): void;
}

