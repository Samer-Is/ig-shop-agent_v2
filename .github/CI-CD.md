# CI/CD Pipeline Documentation

This document explains the complete CI/CD pipeline setup for the Instagram AI Agent SaaS Platform.

## 🏗️ Pipeline Overview

Our CI/CD pipeline consists of three main workflows:

1. **Backend CI/CD Pipeline** (`backend-ci-cd.yml`)
2. **Frontend CI/CD Pipeline** (`frontend-ci-cd.yml`)
3. **Infrastructure Deployment** (`infrastructure-deploy.yml`)

## 🔄 Workflow Triggers

### Automatic Triggers
- **Push to `develop`**: Deploys to development environment
- **Push to `main`**: Deploys to staging environment
- **Pull Requests**: Runs quality checks and tests

### Manual Triggers
- **Production Deployment**: Manual workflow dispatch only
- **Infrastructure Changes**: Manual deployment with environment selection
- **Rollback**: Emergency rollback capability

## 🚀 Deployment Environments

### Development Environment
- **Trigger**: Push to `develop` branch
- **URL**: `https://dev.instagramaiagent.com`
- **Purpose**: Development testing and feature validation
- **Protection**: None (automatic deployment)

### Staging Environment
- **Trigger**: Push to `main` branch
- **URL**: `https://staging.instagramaiagent.com`
- **Purpose**: Pre-production testing and UAT
- **Protection**: Review required for environment access

### Production Environment
- **Trigger**: Manual deployment only
- **URL**: `https://instagramaiagent.com`
- **Purpose**: Live production system
- **Protection**: Multiple approvals required, 5-minute wait timer

## 📊 Pipeline Stages

### Backend Pipeline

#### 1. Quality Gate
- **ESLint**: Code linting and style checks
- **TypeScript**: Compilation verification
- **Prettier**: Code formatting validation
- **Unit Tests**: Jest test suite with coverage
- **E2E Tests**: Integration testing

#### 2. Security Scan
- **NPM Audit**: Dependency vulnerability scan
- **Snyk**: Advanced security analysis
- **SonarCloud**: Code quality and security

#### 3. Build
- **Compilation**: TypeScript to JavaScript
- **Optimization**: Production build optimization
- **Packaging**: Deployment package creation

#### 4. Deployment
- **Development**: Azure App Service deployment
- **Staging**: Blue-green deployment with staging slot
- **Production**: Zero-downtime deployment with slot swapping

### Frontend Pipeline

#### 1. Quality Gate
- **ESLint**: React/TypeScript linting
- **Prettier**: Code formatting
- **TypeScript**: Type checking
- **Unit Tests**: Vitest test suite
- **Coverage**: Test coverage reporting

#### 2. Security & Performance
- **Dependency Scan**: NPM audit and Snyk
- **Accessibility**: axe-core accessibility testing
- **Performance**: Lighthouse performance audit

#### 3. Build Matrix
- **Multi-Environment**: Builds for dev, staging, and prod
- **Environment Variables**: Environment-specific configuration
- **Asset Optimization**: Vite build optimization

#### 4. Deployment
- **Azure Static Web Apps**: Direct deployment
- **Health Checks**: Automated endpoint verification
- **E2E Testing**: Playwright end-to-end tests

### Infrastructure Pipeline

#### 1. Validation
- **Bicep Validation**: Template syntax and structure
- **What-If Analysis**: Change impact assessment
- **Resource Validation**: Azure resource availability

#### 2. Deployment
- **Resource Group**: Creation and configuration
- **Azure Resources**: Complete infrastructure provisioning
- **Output Capture**: Service URLs and connection strings

#### 3. Health Check
- **Service Verification**: All deployed services functional
- **Connectivity**: Database and Key Vault access
- **Monitoring**: Application Insights configuration

## 🛠️ Required Tools and Dependencies

### GitHub Actions Dependencies
- Node.js 18.x
- Azure CLI (latest)
- Docker (for containerized builds)

### Code Quality Tools
- ESLint with TypeScript rules
- Prettier for code formatting
- SonarCloud for code analysis
- Snyk for security scanning

### Testing Frameworks
- **Backend**: Jest for unit/integration tests
- **Frontend**: Vitest for unit tests, Playwright for E2E
- **Performance**: Lighthouse CI for web vitals

## 📝 Environment Configuration

### Required Secrets
See [SECRETS.md](.github/SECRETS.md) for complete list of required GitHub secrets.

### Environment Variables
```bash
# Development
VITE_API_URL=https://dev-api.instagramaiagent.com
VITE_ENVIRONMENT=development

# Staging
VITE_API_URL=https://staging-api.instagramaiagent.com
VITE_ENVIRONMENT=staging

# Production
VITE_API_URL=https://api.instagramaiagent.com
VITE_ENVIRONMENT=production
```

## 🔐 Security Measures

### Code Security
- Dependency vulnerability scanning (NPM Audit + Snyk)
- Static code analysis (SonarCloud)
- Secret scanning prevention
- Code signing and verification

### Deployment Security
- Azure managed identities
- Key Vault integration for secrets
- HTTPS enforcement
- Environment isolation

### Access Control
- Branch protection rules
- Required reviews for production
- Environment-specific approvals
- Audit logging

## 📈 Monitoring and Alerting

### Build Monitoring
- Workflow status notifications
- Slack integration for failures
- Performance metrics tracking
- Test coverage trending

### Deployment Monitoring
- Health check automation
- Rollback capabilities
- Performance monitoring
- Error rate alerting

## 🐛 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check dependencies
npm audit fix

# Verify TypeScript compilation
npm run type-check

# Run tests locally
npm run test:cov
```

#### Deployment Failures
```bash
# Validate Azure credentials
az account show

# Check resource group access
az group show --name rg-insta-agent-dev

# Verify service principal permissions
az role assignment list --assignee <service-principal-id>
```

#### Secret Issues
1. Verify secret names match exactly (case-sensitive)
2. Check JSON format for Azure credentials
3. Validate secret expiration dates
4. Test service principal access manually

### Debug Steps
1. **Check Pipeline Logs**: Review GitHub Actions logs for detailed errors
2. **Validate Secrets**: Ensure all required secrets are configured
3. **Test Locally**: Reproduce issues in local development environment
4. **Azure Resources**: Verify Azure resources are properly provisioned

## 🚨 Emergency Procedures

### Rollback Process
1. Go to GitHub Actions
2. Select "Backend CI/CD Pipeline" or "Frontend CI/CD Pipeline"
3. Click "Run workflow"
4. Select "rollback" environment
5. Confirm rollback execution

### Hotfix Deployment
1. Create hotfix branch from `main`
2. Make necessary changes
3. Create PR to `main`
4. After approval, deploy manually to production

### Incident Response
1. **Identify Issue**: Monitor alerts and logs
2. **Assess Impact**: Determine affected users/features
3. **Execute Rollback**: Use emergency rollback if necessary
4. **Investigate**: Analyze root cause post-incident
5. **Document**: Update runbooks and procedures

## 📋 Maintenance Tasks

### Weekly
- Review dependency updates
- Check security scan results
- Monitor pipeline performance
- Update documentation

### Monthly
- Rotate Azure service principal secrets
- Review access permissions
- Analyze deployment metrics
- Update base images and tools

### Quarterly
- Audit security configurations
- Review and update monitoring
- Performance optimization
- Disaster recovery testing

## 🎯 Performance Metrics

### Key Metrics
- **Build Time**: Target < 10 minutes
- **Test Coverage**: Minimum 80%
- **Deployment Time**: Target < 5 minutes
- **Success Rate**: Target > 95%

### Lighthouse Scores
- **Performance**: > 80
- **Accessibility**: > 90
- **Best Practices**: > 85
- **SEO**: > 80

## 📞 Support

For CI/CD pipeline issues:
1. Check this documentation first
2. Review GitHub Actions logs
3. Consult team knowledge base
4. Create support ticket with detailed logs

## 🔄 Pipeline Updates

When updating pipelines:
1. Test changes in feature branch
2. Review with team
3. Deploy to development first
4. Monitor for issues
5. Document changes 
