/**
 * RE-OS shared UI kit. Every dashboard module should compose list/CRUD screens
 * from these primitives instead of bespoke markup, so search, filtering, tables,
 * add/edit and confirmation flows behave identically platform-wide.
 */
export { Icon, type IconName } from './icons';
export { Drawer, type DrawerWidth } from './Drawer';
export { ActionMenu, type ActionMenuItem } from './ActionMenu';
export { ConfirmDialog } from './ConfirmDialog';
export { DataTable, type DataTableColumn } from './DataTable';
export { CrudToolbar } from './CrudToolbar';
export { Pagination, PAGE_SIZE_OPTIONS } from './Pagination';
export { FilterDrawer, FilterField } from './FilterDrawer';
export { FormField, FormSection } from './FormField';
export { FormDrawer } from './FormDrawer';
export { FormPage, type Breadcrumb } from './FormPage';
export { TagInput } from './TagInput';
export { Combobox, type ComboboxOption } from './Combobox';
export { PhoneInput } from './PhoneInput';

// Re-exported existing shared building blocks so consumers have one import path.
export { EmptyState } from '../shared/EmptyState';
export { LoadingState } from '../shared/LoadingState';
export { PageHeader } from '../shared/PageHeader';
export { ActionGuard as PermissionBoundary } from '../shared/ActionGuard';
