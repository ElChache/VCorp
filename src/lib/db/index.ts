import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const { Pool } = pg;

const pool = new Pool({
	host: 'localhost',
	port: 5433,
	user: 'postgres',
	password: 'password',
	database: 'vcorp',
	ssl: false,
});

export const db = drizzle(pool, { schema });