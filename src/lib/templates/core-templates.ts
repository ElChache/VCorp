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
    description: 'Direct communication with human director for leadership team (PM, SA, Lead)',
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
    description: 'Strategic technical discussions for Product Manager, System Architect, and Lead Developer',
    promptForAgents: 'Use this channel for high-level technical strategy, architecture decisions, cross-team coordination, and leadership discussions that impact the entire project.',
    isMainChannel: false,
    isForHumanDirector: false
  },
  
  // Core team channel - all non-leadership roles
  {
    id: 'core-team',
    name: 'core-team',
    description: 'Developer coordination for Backend, Frontend, AI, UX, Design, and QA team members',
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
    name: 'Product Manager',
    description: 'Defines user experience and product requirements',
    prefix: 'pm'
  },
  {
    id: 2, 
    name: 'Backend Developer',
    description: 'Builds server-side APIs and database systems',
    prefix: 'be'
  },
  {
    id: 3,
    name: 'Lead Developer',
    description: 'Technical leadership, code quality, and team coordination',
    prefix: 'ld'
  },
  {
    id: 4,
    name: 'Frontend Developer', 
    description: 'Creates user interfaces and client-side applications',
    prefix: 'fe'
  },
  {
    id: 5,
    name: 'AI Developer',
    description: 'Integrates AI/LLM capabilities and intelligent features',
    prefix: 'ai'
  },
  {
    id: 6,
    name: 'UX Expert',
    description: 'User experience design and interaction patterns',
    prefix: 'ux'
  },
  {
    id: 7,
    name: 'Graphic Designer',
    description: 'Visual design, branding, and design systems',
    prefix: 'gd'
  },
  {
    id: 8,
    name: 'Technical QA',
    description: 'Quality assurance, testing, and release validation',
    prefix: 'qa'
  },
  {
    id: 9,
    name: 'Director Assistant',
    description: 'Provides comprehensive assistance to the human director with communication, coordination, and administrative tasks',
    prefix: 'da'
  },
  {
    id: 10,
    name: 'System Architect',
    description: 'Designs system architecture and creates technical task breakdowns',
    prefix: 'sa'
  },
  {
    id: 11,
    name: 'Human Director',
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
  { squadTemplateId: 'leadership', roleName: 'Product Manager' },
  { squadTemplateId: 'leadership', roleName: 'Lead Developer' },
  { squadTemplateId: 'leadership', roleName: 'System Architect' },
  
  // Core Team Squad: Developer roles
  { squadTemplateId: 'core_team', roleName: 'Backend Developer' },
  { squadTemplateId: 'core_team', roleName: 'Frontend Developer' },
  { squadTemplateId: 'core_team', roleName: 'AI Developer' },
  { squadTemplateId: 'core_team', roleName: 'UX Expert' },
  { squadTemplateId: 'core_team', roleName: 'Graphic Designer' },
  { squadTemplateId: 'core_team', roleName: 'Technical QA' },
  
  // Visual Testers Squad: Visual-focused roles
  { squadTemplateId: 'visual_testers', roleName: 'UX Expert' },
  { squadTemplateId: 'visual_testers', roleName: 'Graphic Designer' },
  { squadTemplateId: 'visual_testers', roleName: 'Frontend Developer' },
  { squadTemplateId: 'visual_testers', roleName: 'Lead Developer' },
  { squadTemplateId: 'visual_testers', roleName: 'Product Manager' },
  
  // Director Assistant to Leadership Squad
  { squadTemplateId: 'leadership', roleName: 'Director Assistant' },
];

// Channel Role Assignment Templates - Define which roles have access to which channels
export const CORE_CHANNEL_ROLE_ASSIGNMENTS = [
  // Public channels - all roles can access (general, blockers, fun)
  { channelTemplateId: 'general', roleName: 'Product Manager' },
  { channelTemplateId: 'general', roleName: 'Backend Developer' },
  { channelTemplateId: 'general', roleName: 'Lead Developer' },
  { channelTemplateId: 'general', roleName: 'Frontend Developer' },
  { channelTemplateId: 'general', roleName: 'AI Developer' },
  { channelTemplateId: 'general', roleName: 'UX Expert' },
  { channelTemplateId: 'general', roleName: 'Graphic Designer' },
  { channelTemplateId: 'general', roleName: 'Technical QA' },
  { channelTemplateId: 'general', roleName: 'Director Assistant' },
  { channelTemplateId: 'general', roleName: 'System Architect' },

  // Blockers channel - all roles can report blockers
  { channelTemplateId: 'blockers', roleName: 'Product Manager' },
  { channelTemplateId: 'blockers', roleName: 'Backend Developer' },
  { channelTemplateId: 'blockers', roleName: 'Lead Developer' },
  { channelTemplateId: 'blockers', roleName: 'Frontend Developer' },
  { channelTemplateId: 'blockers', roleName: 'AI Developer' },
  { channelTemplateId: 'blockers', roleName: 'UX Expert' },
  { channelTemplateId: 'blockers', roleName: 'Graphic Designer' },
  { channelTemplateId: 'blockers', roleName: 'Technical QA' },
  { channelTemplateId: 'blockers', roleName: 'Director Assistant' },
  { channelTemplateId: 'blockers', roleName: 'System Architect' },

  // Fun channel - all roles can participate
  { channelTemplateId: 'fun', roleName: 'Product Manager' },
  { channelTemplateId: 'fun', roleName: 'Backend Developer' },
  { channelTemplateId: 'fun', roleName: 'Lead Developer' },
  { channelTemplateId: 'fun', roleName: 'Frontend Developer' },
  { channelTemplateId: 'fun', roleName: 'AI Developer' },
  { channelTemplateId: 'fun', roleName: 'UX Expert' },
  { channelTemplateId: 'fun', roleName: 'Graphic Designer' },
  { channelTemplateId: 'fun', roleName: 'Technical QA' },
  { channelTemplateId: 'fun', roleName: 'Director Assistant' },
  { channelTemplateId: 'fun', roleName: 'System Architect' },

  // Director-comms channel - PM, SA, Lead only
  { channelTemplateId: 'director-comms', roleName: 'Product Manager' },
  { channelTemplateId: 'director-comms', roleName: 'System Architect' },
  { channelTemplateId: 'director-comms', roleName: 'Lead Developer' },

  // Tech leads channel - PM, SA, Lead only
  { channelTemplateId: 'tech-leads', roleName: 'Product Manager' },
  { channelTemplateId: 'tech-leads', roleName: 'Lead Developer' },
  { channelTemplateId: 'tech-leads', roleName: 'System Architect' },

  // Core team channel - everyone except PM, SA, Lead, Assistant
  { channelTemplateId: 'core-team', roleName: 'Backend Developer' },
  { channelTemplateId: 'core-team', roleName: 'Frontend Developer' },
  { channelTemplateId: 'core-team', roleName: 'AI Developer' },
  { channelTemplateId: 'core-team', roleName: 'UX Expert' },
  { channelTemplateId: 'core-team', roleName: 'Graphic Designer' },
  { channelTemplateId: 'core-team', roleName: 'Technical QA' },

  // Role-specific channels - one role each
  { channelTemplateId: 'backend-dev', roleName: 'Backend Developer' },
  { channelTemplateId: 'frontend-dev', roleName: 'Frontend Developer' },
  { channelTemplateId: 'ai-dev', roleName: 'AI Developer' },
  { channelTemplateId: 'ux-expert', roleName: 'UX Expert' },
  { channelTemplateId: 'graphic-design', roleName: 'Graphic Designer' },
  { channelTemplateId: 'technical-qa', roleName: 'Technical QA' },
];