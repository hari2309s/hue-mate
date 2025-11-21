export default {
    schema: './src/schema.ts',
    out: './migrations',
    driver: 'pg',
    dbCredentials: {
        connectionString: process.env.DATABASE_URL || '',
    },
};
//# sourceMappingURL=drizzle.config.js.map