export const gd_preparation_phase = {
  name: 'Graphic Design Preparation Phase',
  description: 'Graphic Designer preparation phase with focus on creating visual-style-guide document',
  workflow_description: `Dependencies: MUST wait for Lead Developer's technical-standards, implementation-plan, gd-tasks, and UX Expert's ux-interface-specifications documents

Key Deliverable: Create visual-style-guide document for Frontend Developer implementation

Workflow:
1. Wait for required documents - Periodically check these documents until they exist and are complete:
   - technical-standards document
   - implementation-plan document  
   - ux-interface-specifications document
2. Study technical standards document - Understand technical constraints, asset requirements, and implementation specifications
3. Review implementation plan - Understand overall project architecture and how visual design fits
4. Review your task list - See all specific graphic design tasks assigned by Lead Developer
5. Communicate with Lead Developer - Iteratively discuss tasks until everything is clear and well understood
6. Set up design environment - Configure design tools and asset management systems according to specifications
7. Create design brief - Develop visual direction and brand strategy based on requirements
8. Study UX interface specifications - Understand interface patterns, user flows, and design structure requirements
9. Verify local environment - Make sure you can run the main branch locally within your agent worktree folder
10. Prepare for design work - Ensure understanding of standards, overall plan, UX patterns, and specific tasks
11. Create gd-preparation-report - Brief document noting:
    - Current date/time when report is written
    - Any environment setup problems encountered
    - Dependency installation issues (if any)
    - Configuration challenges faced
    - Overall readiness status

Completion: You are ready to start the implementation of the tickets`,
  required_inputs: ['technical-standards', 'implementation-plan', 'ux-interface-specifications'],
  expected_outputs: ['gd-preparation-report'],
  role_name: 'Graphic Designer'
};

export const gd_implementation_phase = {
  name: 'Graphic Design Implementation Phase',
  description: 'Graphic Designer iterative implementation phase working on tickets',
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
- Provide evidence that visual design meets brand requirements, assets are production-ready, guidelines are comprehensive
- Include design assets, brand guidelines, implementation specifications
- Test thoroughly before marking tickets complete
- Continue working on tickets as they become available
- Keep incrementally building the 'graphic-designer-documentation' document. Keep it tidy and organized, but comprehensive

Continuous design work implementing graphic design features through the ticket system`,
  required_inputs: ['gd-preparation-report'],
  expected_outputs: ['graphic-designer-documentation'],
  role_name: 'Graphic Designer'
};