export const frontend_preparation_phase = {
  name: 'Frontend Preparation Phase',
  description: 'Frontend Developer preparation phase before implementation work',
  workflow_description: `Dependencies: MUST wait for Lead Developer's technical-standards, implementation-plan, fe-tasks, UX Expert's ux-interface-specifications, and Graphic Designer's visual-style-guide documents

Workflow:
1. Wait for required documents - Periodically check these documents until they exist and are complete:
   - technical-standards document
   - implementation-plan document
   - fe-tasks document
   - ux-interface-specifications document
   - visual-style-guide document
2. Study technical standards document - Understand coding standards, architecture patterns, and development environment requirements
3. Review implementation plan - Understand overall project architecture and how frontend components fit
4. Review your task list - See all specific frontend development tasks assigned by Lead Developer
5. Communicate with Lead Developer - Iteratively discuss tasks until everything is clear and well understood
6. Study UX interface specifications - Understand user flows, interaction patterns, and interface behavior requirements
7. Study visual style guide - Understand brand colors, typography, iconography, and visual design requirements
8. Set up development environment - Configure development tools and testing environment according to specifications
9. Create test datasets - Develop comprehensive test scenarios for component validation based on requirements
10. Verify local environment - Make sure you can run the main branch locally within your agent worktree folder
11. Prepare for implementation - Ensure understanding of standards, overall plan, specific tasks, UX patterns, and visual style
12. Create fe-preparation-report - Brief document noting:
    - Current date/time when report is written
    - Any environment setup problems encountered
    - Dependency installation issues (if any)
    - Configuration challenges faced
    - Overall readiness status

Completion: You are ready to start the implementation of the tickets`,
  required_inputs: ['technical-standards', 'implementation-plan', 'development-environment-setup', 'ux-interface-specifications', 'visual-style-guide'],
  expected_outputs: ['fe-preparation-report'],
  role_name: 'Frontend Developer'
};

export const frontend_implementation_phase = {
  name: 'Frontend Implementation Phase',
  description: 'Frontend Developer iterative implementation phase working on tickets',
  workflow_description: `Workflow: Iterative development process working on tickets

This is an ongoing iterative process where you continuously work on tickets assigned to your role:

1. **Get Current Tasks**: Use the API endpoint you already know to fetch your current active tasks/tickets
2. **Select Next Ticket**: Choose an available ticket to work on
3. **Implement**: Work on the ticket following standards from technical-standards document
4. **Test**: Ensure all acceptance criteria are met and test functionality thoroughly
5. **Complete**: Mark the ticket as completed when finished
6. **Repeat**: Continue this cycle with the next available ticket

Key Points:
- Follow coding standards from technical-standards document
- Provide evidence that components work, responsive design functions, accessibility features work
- Test thoroughly before marking tickets complete
- Continue working on tickets as they become available
- Keep incrementally building the 'frontend-documentation' document. Keep it tidy and organized, but comprehensive

Continuous development work implementing frontend features through the ticket system`,
  required_inputs: ['fe-preparation-report'],
  expected_outputs: ['frontend-documentation', 'frontend-working-code'],
  role_name: 'Frontend Developer'
};