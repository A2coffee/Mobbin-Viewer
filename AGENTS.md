# Communication Guidelines
- MUST use Chinese for all communications, including but not limited to outputs, conceptual discussions, and internal reasoning.
- **Terminology**: Retain the English terminology and add "(Chinese translation)" when using it.

# Working Agreements
- All system commands and script executions **MUST** be performed exclusively using `PowerShell`. The use of traditional CMD is strictly prohibited under any circumstances.
## Environment Setup
- Use **pnpm** exclusively as the package manager. Never use npm or yarn.
- **Regular Tasks** All commands must be executed strictly within the root directory `$HOME`.
- **Project Development Tasks** All commands must be executed strictly within the project directory `$HOME/workspace/<project_name>`.
- Standard commands:
  - Install dependencies: `pnpm install`
  - Start dev server: `pnpm dev`
  - Run tests: `pnpm test`

# Workflow & Execution
- **Project Development Tasks**: All files (including code and documentation) MUST be created and modified strictly within `$HOME/workspace/<project_name>`. Modification of files outside this directory is forbidden.
- **Plann Mode** must be strictly followed according to the following process:
  1. **Initialize**: Document the background and granular `- [ ]` To-Do items at `$HOME/workspace/<project_name>/docs/plans/YYYY-MM-DD-<topic>-plan.md`.
  2. **Track State**: MUST check off (`- [x]`) each To-Do item immediately upon step completion.