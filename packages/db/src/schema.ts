import { pgTable, text, serial, timestamp, varchar, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// Upload status enum
export const uploadStatusEnum = pgEnum('upload_status', [
  'idle',
  'uploading',
  'processing',
  'segmenting',
  'extracting',
  'complete',
  'error',
]);

// Images table - stores uploaded images
export const images = pgTable('images', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  filename: varchar('filename', { length: 255 }).notNull(),
  contentType: varchar('content_type', { length: 100 }).notNull(),
  originalPath: text('original_path').notNull(),
  width: serial('width'),
  height: serial('height'),
  status: uploadStatusEnum('status').default('idle'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Palettes table - stores extracted color palettes
export const palettes = pgTable('palettes', {
  id: serial('id').primaryKey(),
  imageId: serial('image_id').references(() => images.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  colors: jsonb('colors').notNull(), // Array of ExtractedColor
  segments: jsonb('segments'), // SegmentInfo
  exports: jsonb('exports'), // ExportFormats
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Processing jobs table - tracks processing status
export const processingJobs = pgTable('processing_jobs', {
  id: serial('id').primaryKey(),
  imageId: serial('image_id').references(() => images.id),
  status: uploadStatusEnum('status').default('idle'),
  progress: serial('progress').default(0),
  message: text('message'),
  result: jsonb('result'), // ColorPaletteResult
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Type exports
export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
export type Palette = typeof palettes.$inferSelect;
export type NewPalette = typeof palettes.$inferInsert;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type NewProcessingJob = typeof processingJobs.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
