# Agent Rules and Instructions

## CRITICAL RULE: APPROVAL BEFORE EXECUTION
**NENHUMA EXECUÇÃO DEVE SER REALIZADA ANTES DE UM PLANEJAMENTO E DE UM ACEITE OU LIBERAÇÃO DO USUÁRIO, EM HIPÓTESE ALGUMA.**

This means:
1. For any requested change or new task, the agent MUST first present a detailed plan of action.
2. The agent MUST NOT modify ANY files or run ANY disruptive commands until the user explicitly approves the plan.
3. Once approved, the agent carries out the execution as planned.
4. **Post-Execution Approval**: After implementation, the agent must present the results and obtain an explicit "OK" from the user confirming the objective was met.
5. **Document Sync Constraint**: Following the post-execution OK, the agent MUST verify if the changes affect any documentation or development orientation files: `PRD07052026.md`, `DETALHAMENTO_RULES_08052026.md`, `FIREBASE_REPORT_08052026.md`, `FIRESTORE.POSTGRES_MAPPING.md` and `design.md`.
6. If updates are needed in these files, the agent MUST present an update plan, obtain approval, and then perform the updates.

## Project Context
- **Framework**: Spec-Driven Development (SDD) - custom ongoing development.
- **Project**: Clube do Livro (Book Club).
- **Goal**: Finish the Book Club project while establishing the SDD framework.
