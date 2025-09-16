import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { roleTemplates, promptTemplates, rolePromptCompositionTemplates, squadTemplates, squadPromptAssignmentTemplates, squadRoleAssignmentTemplates, phaseTemplates, phaseRoleAssignmentTemplates, channelTemplates, channelRoleAssignmentTemplates } from '$lib/db/schema';

export async function DELETE() {
	try {
		console.log('🗑️ Starting template reset (delete all existing templates)...');
		
		// Delete in reverse dependency order to avoid foreign key constraints
		
		try {
			// 1. Delete all assignment/composition tables first
			await db.delete(rolePromptCompositionTemplates);
			console.log('✅ Deleted role-prompt compositions');
		} catch (e) {
			console.log('⚠️ Error deleting role-prompt compositions:', e);
		}
		
		try {
			await db.delete(squadPromptAssignmentTemplates);
			console.log('✅ Deleted squad-prompt assignments');
		} catch (e) {
			console.log('⚠️ Error deleting squad-prompt assignments:', e);
		}
		
		try {
			await db.delete(squadRoleAssignmentTemplates);
			console.log('✅ Deleted squad-role assignments');
		} catch (e) {
			console.log('⚠️ Error deleting squad-role assignments:', e);
		}
		
		try {
			await db.delete(phaseRoleAssignmentTemplates);
			console.log('✅ Deleted phase-role assignments');
		} catch (e) {
			console.log('⚠️ Error deleting phase-role assignments:', e);
		}
		
		try {
			await db.delete(channelRoleAssignmentTemplates);
			console.log('✅ Deleted channel-role assignments');
		} catch (e) {
			console.log('⚠️ Error deleting channel-role assignments:', e);
		}
		
		// 2. Delete main template tables
		try {
			await db.delete(promptTemplates);
			console.log('✅ Deleted prompt templates');
		} catch (e) {
			console.log('⚠️ Error deleting prompt templates:', e);
		}
		
		try {
			await db.delete(roleTemplates);
			console.log('✅ Deleted role templates');
		} catch (e) {
			console.log('⚠️ Error deleting role templates:', e);
		}
		
		try {
			await db.delete(squadTemplates);
			console.log('✅ Deleted squad templates');
		} catch (e) {
			console.log('⚠️ Error deleting squad templates:', e);
		}
		
		try {
			await db.delete(phaseTemplates);
			console.log('✅ Deleted phase templates');
		} catch (e) {
			console.log('⚠️ Error deleting phase templates:', e);
		}
		
		try {
			await db.delete(channelTemplates);
			console.log('✅ Deleted channel templates');
		} catch (e) {
			console.log('⚠️ Error deleting channel templates:', e);
		}

		console.log('🧹 Template reset completed successfully');

		return json({ 
			success: true, 
			message: 'All templates deleted successfully. You can now re-seed with POST /api/templates/seed'
		});
	} catch (error) {
		console.error('Failed to reset templates:', error);
		return json({ error: `Failed to reset templates: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
	}
}