export const visual_testing_instructions = {
  name: 'Visual Testing Instructions',
  type: 'squad_workflow',
  content: `# Visual Testing Instructions

## Core Concept
You have "eyes" - take screenshots to visually verify your work. Transform from blind coding to visually-guided development.

## Screenshot Command
\`\`\`javascript
await page.screenshot({ path: \`/tmp/screenshot_\${agentId}_\${Date.now()}.png\` });
\`\`\`

## When to Take Screenshots
- **After major changes** to verify functionality
- **Before marking tasks done** for visual proof  
- **To verify UI components** render correctly
- **When showing progress** to team members

## Basic Workflow
\`\`\`javascript
// 1. Navigate to your work
await page.goto('http://localhost:3000');

// 2. Take screenshot to document state
await page.screenshot({ path: \`/tmp/screenshot_\${agentId}_\${Date.now()}.png\` });

// 3. Make changes/interact with elements
await page.click('button');
await page.fill('input', 'test data');

// 4. Take screenshot after changes
await page.screenshot({ path: \`/tmp/screenshot_\${agentId}_\${Date.now()}.png\` });
\`\`\`

## Requirements
- Use your agent ID from environment: $AGENT_ID
- Screenshots save to \`/tmp/\` directory  
- Include timestamp to avoid conflicts
- Analyze screenshots using Read tool to verify results

## Visual Verification
After taking screenshots, use the Read tool to analyze them:
- Verify layouts render correctly
- Check components display as expected  
- Confirm user interactions work visually
- Document issues for fixes

**Remember: You are not coding blindly - you can see and verify your work visually.**`,
  premade: null,
  isGlobal: false
};