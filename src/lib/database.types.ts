export type {
  CompositeTypes,
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./database.types.generated";
export { Constants } from "./database.types.generated";

import type { Database } from "./database.types.generated";
import { Constants } from "./database.types.generated";

export type TableName = keyof Database["public"]["Tables"];

export type TableRow<T extends TableName> =
  Database["public"]["Tables"][T]["Row"];

export type EnumName = keyof Database["public"]["Enums"];

export const ENUM_VALUES = Constants.public.Enums;
