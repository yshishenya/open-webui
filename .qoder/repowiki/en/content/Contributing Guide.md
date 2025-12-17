# Contributing Guide

<cite>
**Referenced Files in This Document**   
- [CONTRIBUTING.md](file://docs/CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](file://CODE_OF_CONDUCT.md)
- [package.json](file://package.json)
- [.eslintrc.cjs](file://.eslintrc.cjs)
- [.prettierrc](file://.prettierrc)
- [backend/dev.sh](file://backend/dev.sh)
- [backend/start.sh](file://backend/start.sh)
- [cypress.config.ts](file://cypress.config.ts)
- [backend/requirements.txt](file://backend/requirements.txt)
- [Makefile](file://Makefile)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Development Environment Setup](#development-environment-setup)
3. [Code Style Guidelines](#code-style-guidelines)
4. [Testing Requirements](#testing-requirements)
5. [Issue Tracking and Feature Requests](#issue-tracking-and-feature-requests)
6. [Project Governance and Community Standards](#project-governance-and-community-standards)
7. [Contribution Workflows](#contribution-workflows)
8. [Pull Request Review Process](#pull-request-review-process)
9. [Documentation Updates](#documentation-updates)
10. [Backward Compatibility Considerations](#backward-compatibility-considerations)

## Introduction

This Contributing Guide provides comprehensive information for developers and community members who wish to contribute to the Open WebUI project. The guide covers all aspects of the contribution process, from setting up a development environment to submitting pull requests and understanding the project's governance model. Open WebUI is an open-source web interface for interacting with AI models, and community contributions are essential for its continued improvement and success.

The project welcomes various types of contributions, including code improvements, bug fixes, new features, documentation enhancements, translations, and community support. This guide outlines the processes, standards, and expectations to ensure that contributions are effective, maintainable, and aligned with the project's goals.

**Section sources**
- [CONTRIBUTING.md](file://docs/CONTRIBUTING.md#L1-L89)

## Development Environment Setup

To contribute to Open WebUI, you need to set up a local development environment. The project consists of both frontend and backend components, requiring specific tools and dependencies.

### Prerequisites
- Node.js (version 18.13.0 or higher, up to 22.x.x)
- npm (version 6.0.0 or higher)
- Python (required for backend development)
- Docker (optional, for containerized development)

### Frontend Setup
The frontend is built with SvelteKit and can be started with the following commands:

```bash
npm install
npm run dev
```

This will start the development server, typically accessible at http://localhost:5173. The `dev` script also fetches Pyodide dependencies required for certain functionality.

### Backend Setup
The backend is a Python application using FastAPI. To start the backend in development mode:

```bash
cd backend
./dev.sh
```

The `dev.sh` script sets up the necessary environment variables and starts the Uvicorn server with hot reloading enabled.

### Docker Setup
For containerized development, use Docker Compose:

```bash
docker compose up -d
```

This command starts all required services as defined in the docker-compose configuration files.

**Section sources**
- [package.json](file://package.json#L6-L7)
- [backend/dev.sh](file://backend/dev.sh#L1-L4)
- [Makefile](file://Makefile#L8-L9)

## Code Style Guidelines

Open WebUI enforces consistent code style across the codebase using ESLint and Prettier for frontend code, and Black for backend Python code.

### Frontend Code Style
The frontend code follows these style rules:
- Use tabs for indentation
- Use single quotes for strings
- No trailing commas
- Maximum line length of 100 characters
- Line endings in LF format

These rules are defined in the `.prettierrc` configuration file and are automatically applied when running the format script.

### Backend Code Style
Python code in the backend follows PEP 8 guidelines and is formatted using Black. The formatting can be applied with:

```bash
npm run format:backend
```

### Linting
The project uses ESLint with TypeScript and Svelte support for frontend code analysis. The configuration extends recommended rules from ESLint, TypeScript ESLint, Svelte, and Cypress plugins, while also integrating Prettier to avoid conflicts.

Linting can be run with:
```bash
npm run lint
```

This command runs linting for both frontend and backend code.

**Section sources**
- [.prettierrc](file://.prettierrc#L1-L11)
- [.eslintrc.cjs](file://.eslintrc.cjs#L1-L32)
- [package.json](file://package.json#L13-L18)

## Testing Requirements

Open WebUI includes a comprehensive testing infrastructure to ensure code quality and prevent regressions.

### Frontend Testing
The frontend uses Vitest for unit testing and Cypress for end-to-end testing.

To run frontend unit tests:
```bash
npm run test:frontend
```

To run Cypress end-to-end tests:
```bash
npm run cy:open
```

Cypress tests are located in the `cypress/e2e` directory and cover critical user workflows such as chat interactions, document management, registration, and settings.

### Backend Testing
The backend includes unit tests that can be run with pytest. The requirements.txt file includes pytest and related packages for testing.

### Test Configuration
The Cypress configuration sets the base URL to http://localhost:8080 and enables video recording of test runs for debugging purposes.

All contributions should include appropriate tests for new functionality, and existing tests must pass before a pull request can be merged.

**Section sources**
- [cypress.config.ts](file://cypress.config.ts#L1-L9)
- [package.json](file://package.json#L20-L21)
- [backend/requirements.txt](file://backend/requirements.txt#L131-L134)

## Issue Tracking and Feature Requests

The Open WebUI project uses GitHub Issues and Discussions for tracking bugs and feature requests.

### Reporting Issues
When reporting an issue:
1. Check if the issue has already been reported
2. Use the appropriate issue template
3. Provide detailed information including steps to reproduce, expected behavior, and actual behavior
4. Include relevant environment information

Issues that do not follow the template or lack sufficient detail may be closed without consideration.

### Security Vulnerabilities
Security vulnerabilities should not be reported through public issues. Instead, use the GitHub security reporting functionality to ensure responsible disclosure.

### Feature Requests
Feature requests should be discussed in the GitHub Discussions section before implementation begins. This allows the community and maintainers to provide feedback and ensure alignment with the project's direction.

### Scope Clarification
It's important to distinguish between Open WebUI and Ollama:
- Open WebUI focuses on the web interface for chat interactions
- Ollama is the underlying technology that powers these interactions

Issues related to core Ollama functionality should be directed to the Ollama project repository.

**Section sources**
- [CONTRIBUTING.md](file://docs/CONTRIBUTING.md#L18-L40)

## Project Governance and Community Standards

Open WebUI follows the Contributor Covenant Code of Conduct to ensure a respectful and inclusive community.

### Code of Conduct Principles
The community is committed to creating a harassment-free experience for everyone, regardless of personal characteristics. Key principles include:

- **Respect and professionalism**: All interactions should be respectful and professional
- **Constructive feedback**: Provide thoughtful, actionable feedback that helps improve the project
- **Zero tolerance policy**: Unacceptable behavior will result in immediate enforcement without warning
- **Volunteer appreciation**: Recognize that contributors are volunteering their time and expertise

### Unacceptable Behavior
Examples of unacceptable behavior include:
- Discriminatory or demeaning language
- Personal attacks or harassment
- Publishing private information without permission
- Entitlement or demanding behavior toward volunteers
- Spamming or promotional exploitation

### Enforcement
Community leaders have the authority to take immediate action against violations, including issuing temporary or permanent bans. Reports of violations can be sent to hello@openwebui.com and will be handled confidentially.

The Code of Conduct applies to all community spaces, including repositories, forums, social media, and in-person events.

**Section sources**
- [CODE_OF_CONDUCT.md](file://CODE_OF_CONDUCT.md#L1-L100)

## Contribution Workflows

This section outlines common contribution workflows for fixing bugs and implementing new features.

### Bug Fix Workflow
1. Identify and reproduce the bug
2. Create a new branch from the main branch
3. Implement the fix with appropriate tests
4. Ensure all tests pass
5. Commit changes with a clear message describing the fix
6. Submit a pull request

### New Feature Workflow
1. Open a discussion to propose the feature and gather feedback
2. Design the implementation approach
3. Create a new branch from the main branch
4. Implement the feature with comprehensive tests
5. Update documentation as needed
6. Commit changes with descriptive messages
7. Submit a pull request

### Translation Workflow
To add a new language translation:
1. Create a new directory in `src/lib/i18n/locales` with the appropriate language code
2. Copy the English translation files to the new directory
3. Translate the string values while preserving the JSON structure
4. Add the language code and title to `src/lib/i18n/locales/languages.json`
5. Submit as a standalone pull request (not combined with other changes)

**Section sources**
- [CONTRIBUTING.md](file://docs/CONTRIBUTING.md#L45-L79)

## Pull Request Review Process

The pull request review process ensures code quality and alignment with project goals.

### Pull Request Requirements
Before submitting a pull request:
1. Open a discussion to discuss your ideas
2. Follow the project's coding standards
3. Include tests for new features
4. Update documentation as necessary
5. Write clear, descriptive commit messages
6. Complete the pull request in a timely manner

Pull requests that remain inactive for extended periods may be closed to keep the project moving forward.

### Review Expectations
Contributors should expect:
- Thorough code review focusing on functionality, maintainability, and performance
- Feedback on code style and adherence to project standards
- Requests for additional tests or documentation
- Discussion of potential edge cases and error handling

Maintainers aim to provide timely feedback, but review times may vary based on complexity and maintainer availability.

### Pull Request Templates
The project uses pull request templates that outline requirements. Contributors should complete all checklist items before requesting a review, or submit the PR as a draft if still in progress.

**Section sources**
- [CONTRIBUTING.md](file://docs/CONTRIBUTING.md#L45-L57)

## Documentation Updates

Documentation is a critical part of the Open WebUI project and contributions are welcome.

### Documentation Repositories
The main documentation is maintained in a separate repository:
- [Docs Repository](https://github.com/open-webui/docs)

Contributions to documentation should be submitted to this repository.

### Types of Documentation Contributions
The project welcomes various documentation improvements:
- Installation tutorials and troubleshooting guides
- Configuration guides
- API documentation
- User guides and best practices
- Translation of existing documentation

### Documentation Standards
When updating documentation:
- Use clear, concise language
- Include relevant examples
- Keep information up-to-date with the latest code changes
- Follow the existing documentation structure and style

The documentation website at [docs.openwebui.com](https://docs.openwebui.com) contains growing troubleshooting guides and installation tutorials that can be expanded.

**Section sources**
- [CONTRIBUTING.md](file://docs/CONTRIBUTING.md#L58-L63)

## Backward Compatibility Considerations

When making changes to Open WebUI, backward compatibility is an important consideration.

### API Changes
Changes to public APIs should maintain backward compatibility whenever possible. If breaking changes are necessary:
1. Deprecate the old functionality with appropriate warnings
2. Provide a migration path for users
3. Document the changes clearly in release notes
4. Consider the impact on existing deployments and configurations

### Configuration Changes
Changes to configuration options should:
- Maintain support for existing configuration formats
- Provide clear migration guidance when changes are required
- Avoid removing configuration options without sufficient notice

### Database Migrations
The project uses Alembic for database migrations, with migration scripts in `backend/open_webui/migrations/versions/`. When changes to the database schema are required:
1. Create an appropriate migration script
2. Test the migration thoroughly
3. Ensure the migration is reversible when possible
4. Document any manual steps required during migration

Maintainers carefully evaluate changes that could affect backward compatibility and may require additional justification for breaking changes.

**Section sources**
- [backend/requirements.txt](file://backend/requirements.txt#L25)
- [CONTRIBUTING.md](file://docs/CONTRIBUTING.md#L50-L52)