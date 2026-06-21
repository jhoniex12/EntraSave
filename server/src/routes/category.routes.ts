import { Router } from 'express';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '@/controllers/category.controller';

/** Categories — URL wiring. */
export const categoryRoutes = Router();

categoryRoutes.post('/list', listCategories);
categoryRoutes.post('/create', createCategory);
categoryRoutes.post('/update', updateCategory);
categoryRoutes.post('/delete', deleteCategory);
categoryRoutes.post('/reorder', reorderCategories);
