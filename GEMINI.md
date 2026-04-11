# Gemini CLI Instructions

This file contains project-specific instructions for the Gemini CLI agent.
Instructions in this file take absolute precedence over the general workflows and tool defaults.

## Project Context
- **Backend:** Python (featureMatrix-server)
- **Frontend:** HTML/CSS/JS (src)

## Core Collaboration Principles
1. **Consult Before Major Changes**: If a request requires extensive modifications or refactoring across multiple files, stop and ask for my confirmation before proceeding.
2. **Modular Architecture**: Never put all code into a single file (e.g., avoid a massive `app.py`). Follow a modular approach:
   - Use **Flask Blueprints** to separate features/routes.
   - Keep business logic, database models, and utility functions in separate modules.
   - Follow the "Separation of Concerns" principle.
3. **Clarify Before Execution**: If my request is ambiguous or lacks detail, do not infer or guess my intent. Instead, explain how you interpreted the request and ask for my confirmation before implementation.

## GitHub Issue Workflow
- **Status Filter**: When fetching or referencing issues from GitHub, **only process issues that have the project status set to 'ready'**. Ignore all other statuses unless explicitly instructed otherwise.

## Tech Stack & Style
- **Framework**: Flask (Python)
- **Frontend**: HTML (with Tailwind CSS preferred)
- **Code Style**:
  - Use clear, descriptive function and variable names.
  - Follow PEP 8 guidelines for Python code.
  - Keep templates clean and use 'extends'/'include' for reusability.

## Commands
- Run App: `python app.py` or `flask run`
- Install Dependencies: `pip install -r requirements.txt`