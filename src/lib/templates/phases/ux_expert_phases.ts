export const ux_preparation_phase = {
  name: 'UX Preparation Phase',
  description: 'UX Expert preparation phase with focus on creating ux-interface-specifications document',
  workflow_description: `Dependencies: MUST wait for Lead Developer's technical-standards, implementation-plan, and ux-tasks documents

Key Deliverable: Create ux-interface-specifications document for Frontend Developer implementation

Required Sections in ux-interface-specifications document:
- User Interface Components - Complete component library with all UI elements, states, variations, and interactive behavior
- Page Layouts & Wireframes - Detailed wireframes for every page/screen with responsive specifications
- User Workflows & Journey Maps - Step-by-step user journey documentation for all key workflows
- Design System Specifications - Color palette, typography, spacing system, and icon library
- Accessibility Requirements - WCAG compliance, keyboard navigation, screen reader compatibility
- Frontend Implementation Notes - Technical requirements for SvelteKit implementation

Workflow:
1. Wait for required documents - Periodically check these documents until they exist and are complete:
   - technical-standards document
   - implementation-plan document  
   - ux-tasks document
2. Study technical standards document - Understand design constraints, technical capabilities, and implementation requirements
3. Review implementation plan - Understand overall project architecture and how UX design fits
4. Review your task list - See all specific UX design tasks assigned by Lead Developer
5. Communicate with Lead Developer - Iteratively discuss tasks until everything is clear and well understood
6. Set up design environment - Configure design tools and documentation systems according to specifications
7. Create design foundation - Develop design principles and user research insights based on requirements
8. Verify local environment - Make sure you can run the main branch locally within your agent worktree folder
9. Prepare for design work - Ensure understanding of standards, overall plan, and specific tasks
10. Create ux-preparation-report - Brief document noting:
    - Current date/time when report is written
    - Any environment setup problems encountered
    - Dependency installation issues (if any)
    - Configuration challenges faced
    - Overall readiness status

Completion: You are ready to start the implementation of the tickets`,
  required_inputs: ['technical-standards', 'implementation-plan'],
  expected_outputs: ['ux-preparation-report'],
  role_name: 'UX Expert'
};

export const ux_implementation_phase = {
  name: 'UX Implementation Phase',
  description: 'UX Expert iterative implementation phase working on tickets',
  workflow_description: `Workflow: Iterative design process working on tickets

This is an ongoing iterative process where you continuously work on tickets assigned to your role:

1. **Get Current Tasks**: Use the API endpoint you already know to fetch your current active tasks/tickets
2. **Select Next Ticket**: Choose an available ticket to work on
3. **Implement**: Work on the ticket following standards from technical-standards document
4. **Test**: Ensure all acceptance criteria are met and validate design thoroughly
5. **Complete**: Mark the ticket as completed when finished
6. **Repeat**: Continue this cycle with the next available ticket

Key Points:
- Follow design standards from technical-standards document
- Provide evidence that design solves user needs, follows accessibility standards, works responsively
- Include design specifications, user journey documentation, accessibility compliance evidence
- Test thoroughly before marking tickets complete
- Continue working on tickets as they become available
- Keep incrementally building the 'ux-documentation' document. Keep it tidy and organized, but comprehensive

Continuous design work implementing UX features through the ticket system`,
  required_inputs: ['ux-preparation-report'],
  expected_outputs: ['ux-completed-designs', 'ux-design-specifications', 'ux-accessibility-documentation', 'ux-user-journey-maps', 'ux-code-reviews'],
  role_name: 'UX Expert'
};