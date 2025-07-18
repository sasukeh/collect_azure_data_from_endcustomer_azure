# Contributing to Azure Data Collector

Thank you for your interest in contributing to Azure Data Collector! This document provides guidelines for contributing to the project.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Firebase CLI
- Git

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/azure-data-collector.git
   cd azure-data-collector
   ```

3. Install dependencies:
   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && pip install -r requirements.txt
   ```

4. Set up environment variables (see `.env.example`)

5. Start development servers:
   ```bash
   npm run dev
   ```

## Development Guidelines

### Code Style

#### Frontend (TypeScript/React)
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Use functional components with hooks
- Implement proper error boundaries
- Write unit tests for components

#### Backend (Python)
- Follow PEP 8 style guidelines
- Use type hints for all functions
- Write docstrings for public functions
- Implement proper error handling
- Write unit tests with pytest

### Git Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes with descriptive commits:
   ```bash
   git commit -m "feat: add cost analysis dashboard"
   ```

3. Push to your fork and create a pull request

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code refactoring
- `test:` adding tests
- `chore:` maintenance tasks

### Pull Requests

- Fill out the pull request template
- Include screenshots for UI changes
- Ensure all tests pass
- Update documentation if needed
- Request review from maintainers

## Testing

### Running Tests

```bash
# Frontend tests
cd frontend && npm test

# Backend tests
cd backend && pytest

# Integration tests
npm run test:e2e
```

### Test Coverage

Maintain minimum 80% test coverage for all new code.

## Documentation

- Update README.md for significant changes
- Add inline code comments for complex logic
- Update API documentation in `/docs`
- Include examples for new features

## Deployment

See [Deployment Guide](docs/deployment.md) for detailed instructions.

## Questions?

- Open an issue for bugs or feature requests
- Join our [Discord server](https://discord.gg/your-server) for discussions
- Email: dev@yourcompany.com

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
