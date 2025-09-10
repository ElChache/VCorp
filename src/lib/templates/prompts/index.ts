// Individual template exports
export { general_communication } from './general_communication';
export { executive_to_human_comms } from './executive_to_human_comms';
export { core_team_to_human_comms } from './core_team_to_human_comms';
export { worktree_workflow } from './worktree_workflow';
export { leads_worktree_workflow } from './leads_worktree_workflow';
export { channel_instructions } from './channel_instructions';
export { backend_role } from './backend_role';
export { frontend_role } from './frontend_role';
export { product_manager_role } from './product_manager_role';
export { lead_developer_role } from './lead_developer_role';
export { ai_developer_role } from './ai_developer_role';
export { ux_expert_role } from './ux_expert_role';
export { graphic_designer_role } from './graphic_designer_role';
export { technical_qa_role } from './technical_qa_role';
export { ticketing_system } from './ticketing_system';
export { phase_workflow } from './phase_workflow';
export { visual_testing_instructions } from './visual_testing_instructions';
export { director_assistant_role } from './director_assistant_role';
export { system_architect_role } from './system_architect_role';

// Re-create the CORE_PROMPT_TEMPLATES object from individual templates
import { general_communication } from './general_communication';
import { executive_to_human_comms } from './executive_to_human_comms';
import { core_team_to_human_comms } from './core_team_to_human_comms';
import { worktree_workflow } from './worktree_workflow';
import { leads_worktree_workflow } from './leads_worktree_workflow';
import { channel_instructions } from './channel_instructions';
import { backend_role } from './backend_role';
import { frontend_role } from './frontend_role';
import { product_manager_role } from './product_manager_role';
import { lead_developer_role } from './lead_developer_role';
import { ai_developer_role } from './ai_developer_role';
import { ux_expert_role } from './ux_expert_role';
import { graphic_designer_role } from './graphic_designer_role';
import { technical_qa_role } from './technical_qa_role';
import { ticketing_system } from './ticketing_system';
import { phase_workflow } from './phase_workflow';
import { visual_testing_instructions } from './visual_testing_instructions';
import { director_assistant_role } from './director_assistant_role';
import { system_architect_role } from './system_architect_role';

export const CORE_PROMPT_TEMPLATES = {
  general_communication,
  executive_to_human_comms,
  core_team_to_human_comms,
  worktree_workflow,
  leads_worktree_workflow,
  channel_instructions,
  backend_role,
  frontend_role,
  product_manager_role,
  lead_developer_role,
  ai_developer_role,
  ux_expert_role,
  graphic_designer_role,
  technical_qa_role,
  ticketing_system,
  phase_workflow,
  visual_testing_instructions,
  director_assistant_role,
  system_architect_role
};