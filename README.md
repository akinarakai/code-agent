# Code Agent

Autonomous AI agent designed for software development and codebase management.

## What is it?
Code Agent is a sophisticated AI framework that allows a Large Language Model (LLM) to interact directly with your local file system and terminal. Unlike simple chat bots, this agent can reason about goals, manage its own memory, and execute a series of autonomous actions to solve complex programming tasks.

## Why is it needed?
Traditional AI assistants require the user to copy-paste code manually between the editor and the chat window. Code Agent eliminates this friction by:

- **Direct File Access**: The agent can read, create, and edit files directly in your project.
- **Terminal Execution**: It can run tests, install dependencies, and execute scripts to verify its own changes.
- **Context Management**: It uses a specialized memory and goal system to keep track of long-term objectives and project state, preventing the AI from losing focus during complex refactorings.
- **Autonomous Workflow**: You provide a high-level goal (e.g., "Implement a new authentication system"), and the agent plans the steps, executes them, and verifies the results independently.

## Key Features
- **Goal-Oriented Execution**: Breaks down complex tasks into verifiable milestones.
- **Multi-LLM Support**: Compatible with Groq, OpenRouter, and Ollama.
- **Interactive CLI**: Built with Ink and React for a professional terminal user interface.
- **Memory System**: Maintains a persistent state of project facts and decisions.
- **Extensible Plugin System**: The agent is highly customizable via plugins. Plugins allow you to extend the agent's core functionality by registering:
    - **Commands**: Session management utilities (e.g., `ClearContext`, `ClearMessages`, `Quit`).
    - **Actions**: Powerful tools for the agent to manipulate the environment, such as:
        - **File Operations**: Creating, deleting, writing, and editing files.
        - **Codebase Navigation**: Finding files and searching through content.
        - **Context Control**: Attaching files or the project tree to the AI context.
        - **System Interaction**: Executing shell commands.

By implementing the `BasePlugin` class, you can define custom sets of commands and actions, effectively teaching the agent new skills tailored to your specific development workflow.

## Dependencies
- **ink**: For building the interactive CLI
- **react**: UI framework for Ink
- **typescript**: Static typing for the codebase
- **tsx**: TypeScript execute
- **marked**: Markdown parsing
- **jsonrepair**: Fixing malformed JSON