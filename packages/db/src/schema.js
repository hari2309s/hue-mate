"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.users = exports.palettes = void 0;
var pg_core_1 = require("drizzle-orm/pg-core");
exports.palettes = (0, pg_core_1.pgTable)('palettes', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    colors: (0, pg_core_1.jsonb)('colors').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
