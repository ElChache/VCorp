import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		host: 'localhost',
		port: 5433,
		user: 'postgres',
		password: 'password',
		database: 'vcorp',
		ssl: false,
	},
});