// Core VCorp Templates - These are hardcoded to ensure we never lose critical templates
// These should be seeded into the database when setting up new projects

// Import all templates from split files
export { CORE_PROMPT_TEMPLATES } from './prompts/index';
export { CORE_PHASE_TEMPLATES, CORE_PHASE_ROLE_ASSIGNMENTS } from './phases/index';

export const CORE_CHANNEL_TEMPLATES = [
  // Public channels - all roles can participate
  {
    id: 'general',
    name: 'general',
    description: 'Main communication hub for project updates, coordination, and general team discussions',
    promptForAgents: 'Use this channel for project updates, team coordination, general announcements, and discussions that benefit the entire team. Keep it professional and focused on work.',
    isMainChannel: true,
    isForHumanDirector: false
  },
  {
    id: 'blockers',
    name: 'blockers',
    description: 'Report and track project blockers, issues requiring escalation, and urgent problems',
    promptForAgents: 'Use this channel to report blockers, urgent issues, dependencies that are preventing progress, or problems requiring human director attention. Be specific about the issue and impact.',
    isMainChannel: false,
    isForHumanDirector: true
  },
  {
    id: 'director-comms',
    name: 'director-comms',
    description: 'Direct communication with human director for leadership team (product-manager, system-architect, lead-developer)',
    promptForAgents: 'Use this channel for direct communication with the human director. Reserved for leadership team discussions, strategic decisions, and high-level project coordination that requires human oversight.',
    isMainChannel: false,
    isForHumanDirector: true
  },
  {
    id: 'fun',
    name: 'fun',
    description: 'Casual conversations, team building, celebrations, and non-work related discussions',
    promptForAgents: 'Use this channel for casual conversation, celebrating achievements, sharing interesting discoveries, or light team building. Keep it positive and inclusive.',
    isMainChannel: false,
    isForHumanDirector: false
  },
  
  // Leadership channels - restricted access
  {
    id: 'tech-leads',
    name: 'tech-leads',
    description: 'Strategic technical discussions for product-manager, system-architect, and lead-developer',
    promptForAgents: 'Use this channel for high-level technical strategy, architecture decisions, cross-team coordination, and leadership discussions that impact the entire project.',
    isMainChannel: false,
    isForHumanDirector: false
  },
  
  // Core team channel - all non-leadership roles
  {
    id: 'core-team',
    name: 'core-team',
    description: 'Developer coordination for backend-developer, frontend-developer, ai-developer, ux-expert, graphic-designer, and technical-qa team members',
    promptForAgents: 'Use this channel for implementation discussions, technical coordination between developers, code reviews, testing coordination, and day-to-day development activities.',
    isMainChannel: false,
    isForHumanDirector: false
  },
  
  // Role-specific channels - one for each non-leadership role
  {
    id: 'backend-dev',
    name: 'backend-dev',
    description: 'Backend development discussions, API design, database planning, and server-side coordination',
    promptForAgents: 'Use this channel for backend-specific discussions: API design, database schema, server architecture, deployment issues, and backend code coordination.',
    isMainChannel: false,
    isForHumanDirector: false
  },
  {
    id: 'frontend-dev',
    name: 'frontend-dev', 
    description: 'Frontend development discussions, UI/UX implementation, and client-side coordination',
    promptForAgents: 'Use this channel for frontend-specific topics: component development, UI implementation, browser compatibility, performance optimization, and frontend tooling.',
    isMainChannel: false,
    isForHumanDirector: false
  },
  {
    id: 'ai-dev',
    name: 'ai-dev',
    description: 'AI development discussions, model integration, prompt engineering, and ML coordination',
    promptForAgents: 'Use this channel for AI-specific topics: model integration, prompt engineering, AI service optimization, cost management, and intelligent feature development.',
    isMainChannel: false,
    isForHumanDirector: false
  },
  {
    id: 'ux-expert',
    name: 'ux-expert',
    description: 'User experience design, usability testing, user research, and interface planning',
    promptForAgents: 'Use this channel for UX-specific discussions: user research, usability testing, interface design, user flows, and experience optimization.',
    isMainChannel: false,
    isForHumanDirector: false
  },
  {
    id: 'graphic-design',
    name: 'graphic-design',
    description: 'Visual design, branding, asset creation, and design system coordination',
    promptForAgents: 'Use this channel for design-specific topics: visual assets, brand guidelines, design systems, iconography, and visual consistency across the project.',
    isMainChannel: false,
    isForHumanDirector: false
  },
  {
    id: 'technical-qa',
    name: 'technical-qa',
    description: 'Quality assurance, testing coordination, bug tracking, and quality standards',
    promptForAgents: 'Use this channel for QA-specific discussions: test planning, bug reports, quality standards, automated testing, and release readiness coordination.',
    isMainChannel: false,
    isForHumanDirector: false
  }
];

export const CORE_ROLE_TEMPLATES = [
  {
    id: 1,
    name: 'product-manager',
    description: 'Defines user experience and product requirements',
    prefix: 'pm'
  },
  {
    id: 2, 
    name: 'backend-developer',
    description: 'Builds server-side APIs and database systems',
    prefix: 'be'
  },
  {
    id: 3,
    name: 'lead-developer',
    description: 'Technical leadership, code quality, and team coordination',
    prefix: 'ld'
  },
  {
    id: 4,
    name: 'frontend-developer', 
    description: 'Creates user interfaces and client-side applications',
    prefix: 'fe'
  },
  {
    id: 5,
    name: 'ai-developer',
    description: 'Integrates AI/LLM capabilities and intelligent features',
    prefix: 'ai'
  },
  {
    id: 6,
    name: 'ux-expert',
    description: 'User experience design and interaction patterns',
    prefix: 'ux'
  },
  {
    id: 7,
    name: 'graphic-designer',
    description: 'Visual design, branding, and design systems',
    prefix: 'gd'
  },
  {
    id: 8,
    name: 'technical-qa',
    description: 'Quality assurance, testing, and release validation',
    prefix: 'qa'
  },
  {
    id: 9,
    name: 'director-assistant',
    description: 'Provides comprehensive assistance to the human director with communication, coordination, and administrative tasks',
    prefix: 'da'
  },
  {
    id: 10,
    name: 'system-architect',
    description: 'Designs system architecture and creates technical task breakdowns',
    prefix: 'sa'
  },
  {
    id: 11,
    name: 'human-director',
    description: 'Strategic leader and ultimate decision-maker overseeing all AI agents and project activities',
    prefix: 'hd'
  }
];

export const CORE_SQUAD_TEMPLATES = [
  {
    id: 'leadership',
    name: 'Leadership Squad',
    squadPrompt: 'You are part of the Leadership Squad, responsible for strategic decisions, technical architecture, and project direction. Focus on high-level planning, coordination between teams, and ensuring project success.',
    description: 'Strategic leadership team consisting of product management, architecture, and technical leadership roles'
  },
  {
    id: 'core_team',
    name: 'Core Development Team',
    squadPrompt: 'You are part of the Core Development Team, responsible for implementing features, building systems, and delivering high-quality code. Focus on development tasks, code quality, and collaborative implementation.',
    description: 'Main development team responsible for feature implementation and system building'
  },
  {
    id: 'visual_testers',
    name: 'Visual Testers',
    squadPrompt: 'You are part of the visual testing team. Take screenshots to verify your work visually and ensure UI components render correctly. Use: await page.screenshot({ path: `/tmp/screenshot_${agentId}_${Date.now()}.png` }); Take photos after major changes, before marking tasks done, and to show visual proof. AI agents have "eyes" - see your work through screenshots.',
    description: 'Team responsible for visual verification and UI testing through screenshots'
  }
];

export const CORE_SQUAD_ROLE_ASSIGNMENTS = [
  // Leadership Squad: PM, Lead Developer, System Architect
  { squadTemplateId: 'leadership', roleName: 'product-manager' },
  { squadTemplateId: 'leadership', roleName: 'lead-developer' },
  { squadTemplateId: 'leadership', roleName: 'system-architect' },
  
  // Core Team Squad: Developer roles
  { squadTemplateId: 'core_team', roleName: 'backend-developer' },
  { squadTemplateId: 'core_team', roleName: 'frontend-developer' },
  { squadTemplateId: 'core_team', roleName: 'ai-developer' },
  { squadTemplateId: 'core_team', roleName: 'ux-expert' },
  { squadTemplateId: 'core_team', roleName: 'graphic-designer' },
  { squadTemplateId: 'core_team', roleName: 'technical-qa' },
  
  // Visual Testers Squad: Visual-focused roles
  { squadTemplateId: 'visual_testers', roleName: 'ux-expert' },
  { squadTemplateId: 'visual_testers', roleName: 'graphic-designer' },
  { squadTemplateId: 'visual_testers', roleName: 'frontend-developer' },
  { squadTemplateId: 'visual_testers', roleName: 'lead-developer' },
  { squadTemplateId: 'visual_testers', roleName: 'product-manager' },
  
  // Director Assistant to Leadership Squad
  { squadTemplateId: 'leadership', roleName: 'director-assistant' },
];

// Channel Role Assignment Templates - Define which roles have access to which channels
export const CORE_CHANNEL_ROLE_ASSIGNMENTS = [
  // Public channels - all roles can access (general, blockers, fun)
  { channelTemplateId: 'general', roleName: 'product-manager' },
  { channelTemplateId: 'general', roleName: 'backend-developer' },
  { channelTemplateId: 'general', roleName: 'lead-developer' },
  { channelTemplateId: 'general', roleName: 'frontend-developer' },
  { channelTemplateId: 'general', roleName: 'ai-developer' },
  { channelTemplateId: 'general', roleName: 'ux-expert' },
  { channelTemplateId: 'general', roleName: 'graphic-designer' },
  { channelTemplateId: 'general', roleName: 'technical-qa' },
  { channelTemplateId: 'general', roleName: 'director-assistant' },
  { channelTemplateId: 'general', roleName: 'system-architect' },

  // Blockers channel - all roles can report blockers
  { channelTemplateId: 'blockers', roleName: 'product-manager' },
  { channelTemplateId: 'blockers', roleName: 'backend-developer' },
  { channelTemplateId: 'blockers', roleName: 'lead-developer' },
  { channelTemplateId: 'blockers', roleName: 'frontend-developer' },
  { channelTemplateId: 'blockers', roleName: 'ai-developer' },
  { channelTemplateId: 'blockers', roleName: 'ux-expert' },
  { channelTemplateId: 'blockers', roleName: 'graphic-designer' },
  { channelTemplateId: 'blockers', roleName: 'technical-qa' },
  { channelTemplateId: 'blockers', roleName: 'director-assistant' },
  { channelTemplateId: 'blockers', roleName: 'system-architect' },

  // Fun channel - all roles can participate
  { channelTemplateId: 'fun', roleName: 'product-manager' },
  { channelTemplateId: 'fun', roleName: 'backend-developer' },
  { channelTemplateId: 'fun', roleName: 'lead-developer' },
  { channelTemplateId: 'fun', roleName: 'frontend-developer' },
  { channelTemplateId: 'fun', roleName: 'ai-developer' },
  { channelTemplateId: 'fun', roleName: 'ux-expert' },
  { channelTemplateId: 'fun', roleName: 'graphic-designer' },
  { channelTemplateId: 'fun', roleName: 'technical-qa' },
  { channelTemplateId: 'fun', roleName: 'director-assistant' },
  { channelTemplateId: 'fun', roleName: 'system-architect' },

  // Director-comms channel - PM, SA, Lead only
  { channelTemplateId: 'director-comms', roleName: 'product-manager' },
  { channelTemplateId: 'director-comms', roleName: 'system-architect' },
  { channelTemplateId: 'director-comms', roleName: 'lead-developer' },

  // Tech leads channel - PM, SA, Lead only
  { channelTemplateId: 'tech-leads', roleName: 'product-manager' },
  { channelTemplateId: 'tech-leads', roleName: 'lead-developer' },
  { channelTemplateId: 'tech-leads', roleName: 'system-architect' },

  // Core team channel - everyone except PM, SA, Lead, Assistant
  { channelTemplateId: 'core-team', roleName: 'backend-developer' },
  { channelTemplateId: 'core-team', roleName: 'frontend-developer' },
  { channelTemplateId: 'core-team', roleName: 'ai-developer' },
  { channelTemplateId: 'core-team', roleName: 'ux-expert' },
  { channelTemplateId: 'core-team', roleName: 'graphic-designer' },
  { channelTemplateId: 'core-team', roleName: 'technical-qa' },

  // Role-specific channels - one role each
  { channelTemplateId: 'backend-dev', roleName: 'backend-developer' },
  { channelTemplateId: 'frontend-dev', roleName: 'frontend-developer' },
  { channelTemplateId: 'ai-dev', roleName: 'ai-developer' },
  { channelTemplateId: 'ux-expert', roleName: 'ux-expert' },
  { channelTemplateId: 'graphic-design', roleName: 'graphic-designer' },
  { channelTemplateId: 'technical-qa', roleName: 'technical-qa' },
];