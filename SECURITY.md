# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please send an email to security@yourcompany.com. Please do not report security vulnerabilities through public GitHub issues.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Security Measures

### Authentication & Authorization
- Multi-tenant Azure Entra ID integration
- OAuth 2.0 / OpenID Connect
- Least privilege access principles
- Regular token refresh

### Data Protection
- End-to-end encryption in transit (HTTPS/TLS 1.3)
- Data encryption at rest (Firebase/Azure encryption)
- No sensitive data in logs
- Secure credential storage

### Infrastructure Security
- Firebase Security Rules for data access control
- Cloud Functions with minimal runtime permissions
- Regular dependency updates
- Automated security scanning

### Development Security
- Code review requirements
- Automated security testing in CI/CD
- Secret management via GitHub Secrets
- Vulnerability scanning with dependabot

## Compliance
- GDPR compliance for EU users
- Data retention policies
- User data deletion on request
- Audit logging
