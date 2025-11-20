import {
  pgTable,
  text,
  serial,
  timestamp,
  json,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const palettes = pgTable("palettes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  name: text("name").notNull(),
  colors: json("colors")
    .$type<
      {
        hex: string;
        rgb: [number, number, number];
        hsl: [number, number, number];
        name?: string;
      }[]
    >()
    .notNull(),
  imageUrl: text("image_url"),
  tailwindConfig: text("tailwind_config"),
  figmaVariables: text("figma_variables"),
  isPublic: boolean("is_public").default(false),
  views: integer("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  key: text("key").unique().notNull(),
  usage: integer("usage").default(0),
  limit: integer("limit").default(10),
  createdAt: timestamp("created_at").defaultNow(),
});
