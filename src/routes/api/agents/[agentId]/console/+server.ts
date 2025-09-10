import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';

// Get live console output from agent's tmux session
export async function GET({ params }) {
	try {
		const { agentId } = params;
		
		if (!agentId) {
			return json({ error: 'Agent ID is required' }, { status: 400 });
		}

		const sessionName = `vcorp-${agentId}`;
		
		try {
			// Get the last 50 lines from the tmux session
			const output = execSync(
				`tmux capture-pane -t "${sessionName}" -S -50 -p`,
				{ encoding: 'utf8', timeout: 2000 }
			);

			return json({ 
				success: true, 
				agentId,
				sessionName,
				output: output.trim(),
				timestamp: new Date().toISOString()
			});

		} catch (tmuxError) {
			// Session doesn't exist or can't be accessed
			return json({ 
				success: false,
				error: 'Console not available',
				agentId,
				sessionName,
				output: 'Agent session not found or not accessible.',
				timestamp: new Date().toISOString()
			});
		}

	} catch (error) {
		console.error('Failed to get console output:', error);
		return json({ error: 'Failed to get console output' }, { status: 500 });
	}
}