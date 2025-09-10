export const qa_preparation_phase = {
  name: 'QA Preparation Phase',
  description: 'Technical QA preparation phase before testing implementation',
  workflow_description: `Dependencies: MUST wait for Lead Developer's technical-standards, development-environment-setup, implementation-plan, and qa-tasks documents

Workflow:
1. Wait for required documents - Periodically check these documents until they exist and are complete:
   - technical-standards document
   - development-environment-setup document
   - implementation-plan document
   - qa-tasks document
2. Study technical standards document - Understand coding standards, architecture patterns, and testing requirements
3. Study development environment setup - Configure local testing environment correctly
4. Review implementation plan - Understand overall project architecture and how QA testing fits
5. Review your task list - See all specific QA tasks assigned by Lead Developer
6. Set up testing environment - Configure testing tools and validation environment according to specifications
7. Create test datasets - Develop comprehensive test scenarios for system validation based on requirements
8. Prepare for testing - Ensure understanding of standards, environment setup, overall plan, and specific tasks
9. Create qa-preparation-report - Brief document noting:
   - Current date/time when report is written
   - Any environment setup problems encountered
   - Dependency installation issues (if any)
   - Configuration challenges faced
   - Overall readiness status

Completion: Ready to begin QA testing work with proper testing environment and comprehensive test scenarios`,
  required_inputs: ['technical-standards', 'development-environment-setup', 'implementation-plan'],
  expected_outputs: ['qa-preparation-report'],
  role_name: 'Technical QA'
};

export const qa_implementation_phase = {
  name: 'QA Implementation Phase',
  description: 'Technical QA iterative implementation phase with cross-team testing responsibility',
  workflow_description: `Workflow: Iterative feedback loop with Lead Developer using qa-tasks document, plus cross-team testing responsibility

Step 1: Pick Next Task
- FIRST PRIORITY: Monitor ALL TASKS files for work needing QA testing:
  - Check be-tasks document for tasks with status "needs qa"
  - Check fe-tasks document for tasks with status "needs qa"
  - Check ai-tasks document for tasks with status "needs qa"
  - Check ux-tasks document for tasks with status "needs qa"
  - Check gd-tasks document for tasks with status "needs qa"
- SECOND PRIORITY: Review qa-tasks document for assigned QA tasks with status "ready"
- Follow communication protocol for complete task status management
- Prioritize testing "needs qa" tasks from other developers before working on own QA tasks
- If no tasks need testing and no QA tasks are "ready", wait and check again

Step 2: Complete Task
- Work on the task following standards from technical-standards document
- Ensure all acceptance criteria are met
- Test functionality thoroughly
- When bugs are found during testing:
  1. Determine which team should fix the bug (BE, FE, AI, UX, GD)
  2. File the bug in the appropriate TASKS document:
     - Backend bugs → be-tasks document
     - Frontend bugs → fe-tasks document
     - AI-related bugs → ai-tasks document
     - UX design bugs → ux-tasks document
     - Visual/branding bugs → gd-tasks document
  3. Use format "Bug: [description]" and set initial status as "ready"

Step 3: Submit for Review
- Update task status in qa-tasks document to "needs review"
- Add completion details to the same task entry - include test results, validation evidence, issue reports
- Demonstrate functionality - provide evidence that testing was thorough, issues were identified, quality standards met

Step 4: Review Response
- Wait for Lead Developer review - Check qa-tasks document periodically for status updates
- Monitor task status - Continue checking until Lead Developer updates the task status and adds review notes
- If Lead Developer marks status as "approved": Move to Step 1 for next task
- If Lead Developer marks status as "changes requested": Address feedback notes and return to Step 2
- All communication happens in the task entry within qa-tasks document
- Do not proceed to other tasks until current task review is complete

Step 5: Iterate
- Continue this cycle until all QA tasks in qa-tasks document are marked "approved"
- Each task must be individually approved before being considered complete

Continuous testing work with dual responsibility: own QA tasks and cross-team validation`,
  required_inputs: ['qa-preparation-report'],
  expected_outputs: ['qa-completed-tests', 'qa-test-reports', 'qa-bug-reports', 'qa-validation-evidence', 'qa-code-reviews'],
  role_name: 'Technical QA'
};