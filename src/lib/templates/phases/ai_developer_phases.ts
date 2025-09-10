export const ai_preparation_phase = {
  name: 'AI Preparation Phase',
  description: 'AI Developer preparation phase before implementation work',
  workflow_description: `Dependencies: MUST wait for Lead Developer's technical-standards, implementation-plan, and ai-tasks documents

Workflow:
1. Wait for required documents - Periodically check these documents until they exist and are complete:
   - technical-standards
   - implementation-plan
2. Study technical standards document - Understand coding standards, architecture patterns, and development environment requirements
3. Review implementation plan - Understand overall project architecture and how AI components fit
4. Review all your tasks - See all specific AI development tasks assigned by Lead Developer
5. Communicate with Lead Developer - Iteratively discuss tasks until everything is clear and well understood
6. Verify local environment - Make sure you can run the main branch locally within your agent worktree folder
7. Prepare for implementation - Ensure understanding of standards, overall plan, and specific tasks
8. Create ai-preparation-report - Brief document noting:
   - Current date/time when report is written
   - Any environment setup problems encountered
   - Dependency installation issues (if any)
   - Configuration challenges faced
   - Overall readiness status

Completion: You are ready to start the implementation of the tickets`,
  required_inputs: ['technical-standards', 'implementation-plan', 'development-environment-setup'],
  expected_outputs: ['ai-preparation-report'],
  role_name: 'AI Developer'
};

export const ai_implementation_phase = {
  name: 'AI Implementation Phase',
  description: 'AI Developer iterative implementation phase working on tickets',
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
- Provide evidence that AI features work, prompts parse correctly, error handling functions
- Test thoroughly before marking tickets complete
- Continue working on tickets as they become available

Continuous development work implementing AI features through the ticket system`,
  required_inputs: ['ai-preparation-report'],
  expected_outputs: ['ai-documentation'],
  role_name: 'AI Developer'
};