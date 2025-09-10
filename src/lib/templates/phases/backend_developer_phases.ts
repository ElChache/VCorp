export const backend_preparation_phase = {
  name: 'Backend Preparation Phase',
  description: 'Backend Developer preparation phase before implementation work',
  workflow_description: `Dependencies: MUST wait for Lead Developer's technical-standards, development-environment-setup, implementation-plan, and be-tasks documents

Workflow:
1. Wait for required documents - Periodically check these documents until they exist and are complete:
   - technical-standards document
   - development-environment-setup document  
   - implementation-plan document
   - be-tasks document
2. Study technical standards document - Understand coding standards, architecture patterns, and development requirements
3. Study development environment setup - Configure local development environment correctly
4. Review implementation plan - Understand overall project architecture and how backend components fit
5. Review your task list - See all specific backend development tasks assigned by Lead Developer
6. Communicate with Lead Developer - Iteratively discuss tasks until everything is clear and well understood
7. Set up development environment - Configure development tools and testing environment according to specifications
8. Verify local environment - Make sure you can run the main branch locally within your agent worktree folder
9. Prepare for implementation - Ensure understanding of standards, environment setup, overall plan, and specific tasks
10. Create be-preparation-report - Brief document noting:
    - Current date/time when report is written
    - Any environment setup problems encountered
    - Dependency installation issues (if any)
    - Configuration challenges faced
    - Overall readiness status

Completion: You are ready to start the implementation of the tickets`,
  required_inputs: ['technical-standards', 'development-environment-setup', 'implementation-plan',],
  expected_outputs: ['be-preparation-report'],
  role_name: 'Backend Developer'
};

export const backend_implementation_phase = {
  name: 'Backend Implementation Phase', 
  description: 'Backend Developer iterative implementation phase working on tickets',
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
- Provide evidence that features work, APIs respond correctly, error handling functions
- Test thoroughly before marking tickets complete
- Continue working on tickets as they become available
- Keep incrementally building the 'backend-documentation' document. Keep it tidy and organized, but comprehensive.

Continuous development work implementing backend features through the ticket system`,
  required_inputs: ['be-preparation-report'],
  expected_outputs: ['backend-completed-features', 'backend-documentation'],
  role_name: 'Backend Developer'
};