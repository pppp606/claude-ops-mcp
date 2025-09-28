#!/usr/bin/env bash

# Test script to verify workflow permissions configuration
# This script validates that GitHub Actions workflows follow minimal permission principles

set -e

WORKFLOW_FILE=".github/workflows/ci.yml"
FAILED=0

echo "🔍 Verifying workflow permissions in $WORKFLOW_FILE"
echo "======================================================="

# Check if workflow file exists
if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "❌ Workflow file not found: $WORKFLOW_FILE"
    exit 1
fi

# Check for default permissions at workflow level
DEFAULT_PERMISSIONS=$(grep -A 2 "^permissions:" "$WORKFLOW_FILE" | grep "contents: read" || true)
if [ -n "$DEFAULT_PERMISSIONS" ]; then
    echo "✅ Default workflow permissions set to read-only"
else
    echo "❌ Default workflow permissions not configured"
    FAILED=1
fi

# Check each job for explicit permissions
JOBS=("quality-checks" "security-audit" "integration-test" "publish-check")

for JOB in "${JOBS[@]}"; do
    echo ""
    echo "Checking job: $JOB"

    # Find job section and check for permissions
    JOB_SECTION=$(sed -n "/^  $JOB:/,/^  [a-zA-Z]/p" "$WORKFLOW_FILE")

    if echo "$JOB_SECTION" | grep -q "permissions:"; then
        echo "  ✅ Job has explicit permissions configured"

        # Check for contents: read
        if echo "$JOB_SECTION" | grep -q "contents: read"; then
            echo "  ✅ Contents permission set to read"
        else
            echo "  ⚠️  Contents permission not explicitly set to read"
        fi

        # Check for minimal permissions only
        PERMISSION_COUNT=$(echo "$JOB_SECTION" | grep -c ":" | grep -v "name:\|runs-on:\|needs:\|if:" || true)
        if [ "$PERMISSION_COUNT" -le 3 ]; then
            echo "  ✅ Minimal permissions configured"
        else
            echo "  ⚠️  Consider reducing permissions count: $PERMISSION_COUNT"
        fi

    else
        echo "  ❌ Job missing explicit permissions configuration"
        FAILED=1
    fi
done

echo ""
echo "======================================================="

# Check for potential security issues
echo "Security checks:"

# Check for write permissions to sensitive areas
SENSITIVE_WRITES=$(grep -E "(contents|repository-projects|pull-requests|issues|deployments): write" "$WORKFLOW_FILE" || true)
if [ -n "$SENSITIVE_WRITES" ]; then
    echo "⚠️  Found write permissions to sensitive areas:"
    echo "$SENSITIVE_WRITES"
    echo "   Please review if these are necessary"
else
    echo "✅ No sensitive write permissions found"
fi

# Check for admin permissions
ADMIN_PERMS=$(grep -E "(admin|maintain)" "$WORKFLOW_FILE" || true)
if [ -n "$ADMIN_PERMS" ]; then
    echo "❌ Admin/maintain permissions found - this is dangerous!"
    echo "$ADMIN_PERMS"
    FAILED=1
else
    echo "✅ No admin permissions found"
fi

# Check for wildcard permissions
WILDCARD_PERMS=$(grep -E "permissions:.*\*" "$WORKFLOW_FILE" || true)
if [ -n "$WILDCARD_PERMS" ]; then
    echo "❌ Wildcard permissions found - this is dangerous!"
    echo "$WILDCARD_PERMS"
    FAILED=1
else
    echo "✅ No wildcard permissions found"
fi

echo "======================================================="

if [ "$FAILED" -eq 0 ]; then
    echo "✅ All workflow permission checks passed!"
    echo "🔒 Security: Minimal permission principles applied"
    exit 0
else
    echo "❌ Some workflow permission checks failed"
    echo "🔓 Security: Review and fix permission configuration"
    exit 1
fi