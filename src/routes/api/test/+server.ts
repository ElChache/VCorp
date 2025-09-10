import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { sql } from 'drizzle-orm';

export async function GET() {
	try {
		// Test database connection and get PostgreSQL version
		const versionResult = await db.execute(sql`SELECT version()`);
		const version = versionResult.rows[0]?.version || 'Unknown';

		// Test basic table query
		const agentsResult = await db.execute(sql`SELECT COUNT(*) as count FROM agents`);
		const agentCount = agentsResult.rows[0]?.count || 0;

		return json({
			success: true,
			database: {
				connected: true,
				version: version,
				agentCount: Number(agentCount)
			},
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Database test failed:', error);
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
}