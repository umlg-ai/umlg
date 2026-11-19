import { ThemeDefinition } from '../types';
import {
  createCoreEntity,
  createCoreLink,
  updateCoreEntity,
  updateCoreLink,
} from './core-primitives';
import { getIndustrialEnvironment } from './materials';

export const industrialV1Theme: ThemeDefinition = {
  id: 'industrial-v1',
  label: 'Industrial Factory (v1)',
  description: 'Индустриальный конвейер Satisfactory: голограммы в M-мире и PBR-агрегаты в R-мире.',
  getEnvironment: getIndustrialEnvironment,
  createEntityObject: createCoreEntity,
  updateEntityObject: updateCoreEntity,
  createLinkObject: createCoreLink,
  updateLinkObject: updateCoreLink,
};

export { graphicsGpuPlugin } from './profiles/graphics-gpu';

