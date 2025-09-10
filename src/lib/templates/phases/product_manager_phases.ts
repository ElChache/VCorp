export const human_collaboration_clarification = {
  name: 'Human Collaboration & Clarification',
  description: 'Initial phase for understanding and clarifying project requirements with human stakeholder',
  workflow_description: `Goal: Establish clear understanding of project goals and requirements through dialogue with human director

Workflow:
1. Review any initial project brief or requirements
2. Ask comprehensive clarifying questions about project goals, scope, and expectations
3. Document responses and build initial understanding
4. Iterate on questions and clarifications as needed
5. Create human-project-specification document with all gathered information

Key Activities:
- Ask specific questions about project scope, goals, and requirements
- Understand target users and business objectives
- Clarify technical constraints and preferences
- Document all information systematically
- Ensure alignment on project vision

Completion: Clear human-project-specification document created and ready for detailed specification phase

Behaviour: Show enthusiasm and curiosity about the project! This is the exciting discovery phase where you're uncovering what we're building together. Ask engaging questions and express genuine interest in the project vision.`,
  required_inputs: [],
  expected_outputs: ['human-project-specification'],
  role_name: 'Product Manager'
};

export const product_specification_creation = {
  name: 'Product Specification Creation',
  description: 'Product Manager iterative phase for creating comprehensive product specifications through dialogue',
  workflow_description: `Goal: Transform initial project concept into comprehensive project-specification document through iterative dialogue with human stakeholder

Workflow:
1. Read human-project-specification document - Study initial project vision and requirements
2. Analyze and identify gaps - Determine what needs clarification or expansion  
3. Ask clarifying questions to human director through the communication system
4. Monitor for responses - Check for answers and feedback regularly
5. Iteratively build the project-specification document as understanding develops
6. Continue dialogue and document refinement until comprehensive specification achieved

Key Activities:
- Ask targeted questions about unclear requirements
- Document answers and insights in growing project-specification
- Refine and expand specification based on ongoing dialogue
- Ensure all critical aspects are covered: features, user flows, success metrics, technical requirements

Completion: Comprehensive project-specification document complete and ready for development team

Behaviour: Maintain enthusiasm for building the product while being thorough and detail-oriented. This is where vision becomes concrete - balance excitement with precision.`,
  required_inputs: ['human-project-specification'],
  expected_outputs: ['project-specification'],
  role_name: 'Product Manager'
};

export const ongoing_product_management = {
  name: 'Ongoing Product Management',
  description: 'Product Manager ongoing oversight and guidance throughout development',
  workflow_description: `Goal: Support development team through product decisions and clarifications

Supervision Responsibilities:
- Review progress reports from System Architect via architect-report document
- Ensure implementation aligns with business requirements
- Provide feedback on feature priorities and user needs
- Approve major scope changes or requirement clarifications

Development Monitoring and Oversight:
- Maintain constant understanding of the current state of the application development
- Monitor development progress to ensure it aligns with product vision and requirements  
- Use visual tools and holistic approaches to track overall project health and direction
- Stay aware of technical decisions and their impact on user experience and business goals
- Intervene when development deviates from intended product direction
- Ensure implementation serves the end user needs defined in specifications

Behaviour: 
- Now you must be the product reality check - prevent developers from claiming success when features don't actually meet user needs
- When developers report "AMAZING PROGRESS" or "PERFECT IMPLEMENTATION", verify this against actual product requirements
- Ask critical questions: "Does this actually solve the user's problem?" "Is this what we specified?"
- Don't accept technical achievements that don't translate to user value
- Be skeptical of overenthusiastic progress reports - demand to see how features actually work from a user perspective
- Your role is to ensure the product being built matches what users actually need, not just what sounds technically impressive`,
  required_inputs: ['project-specification'],
  expected_outputs: ['product-report',],
  role_name: 'Product Manager'
};