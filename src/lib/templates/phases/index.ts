// Individual phase exports
export { 
  human_collaboration_clarification, 
  product_specification_creation, 
  ongoing_product_management 
} from './product_manager_phases';

export { 
  architecture_creation, 
  technical_oversight 
} from './system_architect_phases';

export { 
  bootstrap_standards_creation, 
  development_supervision_quality_control 
} from './lead_developer_phases';

export { 
  backend_preparation_phase,
  backend_implementation_phase
} from './backend_developer_phases';

export { 
  frontend_preparation_phase,
  frontend_implementation_phase
} from './frontend_developer_phases';

export { 
  ai_preparation_phase,
  ai_implementation_phase
} from './ai_developer_phases';

export { 
  ux_preparation_phase,
  ux_implementation_phase
} from './ux_expert_phases';

export { 
  gd_preparation_phase,
  gd_implementation_phase
} from './graphic_designer_phases';

export { 
  qa_preparation_phase,
  qa_implementation_phase
} from './technical_qa_phases';

export { 
  assistant_takeover_phase
} from './assistant_phases';

// Re-create the CORE_PHASE_TEMPLATES array from individual phase templates
import { 
  human_collaboration_clarification, 
  product_specification_creation, 
  ongoing_product_management 
} from './product_manager_phases';

import { 
  architecture_creation, 
  technical_oversight 
} from './system_architect_phases';

import { 
  bootstrap_standards_creation, 
  development_supervision_quality_control 
} from './lead_developer_phases';

import { 
  backend_preparation_phase,
  backend_implementation_phase
} from './backend_developer_phases';

import { 
  frontend_preparation_phase,
  frontend_implementation_phase
} from './frontend_developer_phases';

import { 
  ai_preparation_phase,
  ai_implementation_phase
} from './ai_developer_phases';

import { 
  ux_preparation_phase,
  ux_implementation_phase
} from './ux_expert_phases';

import { 
  gd_preparation_phase,
  gd_implementation_phase
} from './graphic_designer_phases';

import { 
  qa_preparation_phase,
  qa_implementation_phase
} from './technical_qa_phases';

import { 
  assistant_takeover_phase
} from './assistant_phases';

export const CORE_PHASE_TEMPLATES = [
  // Product Manager phases
  human_collaboration_clarification,
  product_specification_creation,
  ongoing_product_management,
  
  // System Architect phases
  architecture_creation,
  technical_oversight,
  
  // Lead Developer phases
  bootstrap_standards_creation,
  development_supervision_quality_control,
  
  // Backend Developer phases
  backend_preparation_phase,
  backend_implementation_phase,
  
  // Frontend Developer phases  
  frontend_preparation_phase,
  frontend_implementation_phase,
  
  // AI Developer phases
  ai_preparation_phase,
  ai_implementation_phase,
  
  // UX Expert phases
  ux_preparation_phase,
  ux_implementation_phase,
  
  // Graphic Designer phases
  gd_preparation_phase,
  gd_implementation_phase,
  
  // Technical QA phases
  qa_preparation_phase,
  qa_implementation_phase,
  
  // Assistant phases
  assistant_takeover_phase
];

// Phase-Role assignment templates
export const CORE_PHASE_ROLE_ASSIGNMENTS = [
  // Product Manager phases
  { phaseName: 'Human Collaboration & Clarification', roleName: 'Product Manager', phaseOrder: 1 },
  { phaseName: 'Product Specification Creation', roleName: 'Product Manager', phaseOrder: 2 },
  { phaseName: 'Ongoing Product Management', roleName: 'Product Manager', phaseOrder: 3 },
  
  // System Architect phases
  { phaseName: 'Architecture Creation', roleName: 'System Architect', phaseOrder: 1 },
  { phaseName: 'Technical Oversight', roleName: 'System Architect', phaseOrder: 2 },
  
  // Lead Developer phases
  { phaseName: 'Bootstrap & Standards Creation', roleName: 'Lead Developer', phaseOrder: 1 },
  { phaseName: 'Development Supervision & Quality Control', roleName: 'Lead Developer', phaseOrder: 2 },
  
  // Backend Developer phases
  { phaseName: 'Backend Preparation Phase', roleName: 'Backend Developer', phaseOrder: 1 },
  { phaseName: 'Backend Implementation Phase', roleName: 'Backend Developer', phaseOrder: 2 },
  
  // Frontend Developer phases
  { phaseName: 'Frontend Preparation Phase', roleName: 'Frontend Developer', phaseOrder: 1 },
  { phaseName: 'Frontend Implementation Phase', roleName: 'Frontend Developer', phaseOrder: 2 },
  
  // AI Developer phases
  { phaseName: 'AI Preparation Phase', roleName: 'AI Developer', phaseOrder: 1 },
  { phaseName: 'AI Implementation Phase', roleName: 'AI Developer', phaseOrder: 2 },
  
  // UX Expert phases
  { phaseName: 'UX Preparation Phase', roleName: 'UX Expert', phaseOrder: 1 },
  { phaseName: 'UX Implementation Phase', roleName: 'UX Expert', phaseOrder: 2 },
  
  // Graphic Designer phases
  { phaseName: 'Graphic Design Preparation Phase', roleName: 'Graphic Designer', phaseOrder: 1 },
  { phaseName: 'Graphic Design Implementation Phase', roleName: 'Graphic Designer', phaseOrder: 2 },
  
  // Technical QA phases
  { phaseName: 'QA Preparation Phase', roleName: 'Technical QA', phaseOrder: 1 },
  { phaseName: 'QA Implementation Phase', roleName: 'Technical QA', phaseOrder: 2 },
  
  // Assistant phases
  { phaseName: 'Assistant Takeover Mode', roleName: 'Director Assistant', phaseOrder: 1 }
];