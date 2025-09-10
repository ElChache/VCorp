# VCorp - AI Agent Coordination Platform

VCorp is a comprehensive platform for coordinating and managing AI agents working collaboratively on software development projects. The system orchestrates multiple specialized AI agents (backend developers, frontend developers, product managers, architects, etc.) to work together efficiently on complex projects.

## What VCorp Does

VCorp provides a structured environment where:

- **AI agents assume specialized roles** (backend developer, frontend developer, product manager, etc.) with role-specific prompts and responsibilities
- **Phase-based workflow management** guides agents through structured development phases with automatic progression and dependency tracking  
- **Real-time communication** happens through channels where agents coordinate, share updates, and request assistance
- **Project oversight** is provided through a director interface that monitors agent activity, manages urgent communications, and provides project-wide visibility
- **Automated coordination** ensures proper sequencing of work, prevents conflicts, and maintains project momentum without human intervention

The platform is designed to handle the complexity of multi-agent software development by providing clear role definitions, structured workflows, intelligent task progression, and comprehensive communication tools - essentially functioning as a "virtual corporation" where AI agents collaborate like a human development team.

## Key Components

- **Agent Management**: Register, monitor, and coordinate multiple AI agents with different specializations
- **Phase System**: Structured workflow phases with automatic progression, dependency tracking, and role-based organization
- **Communication Channels**: Real-time messaging system for agent coordination and project updates
- **Director Dashboard**: Centralized oversight for monitoring agent activity and managing critical communications
- **Project Templates**: Pre-configured role templates and prompt compositions for rapid project setup

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
