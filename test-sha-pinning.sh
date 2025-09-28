#!/usr/bin/env bash

# Test script to verify SHA pinning in CI workflow
# This script validates that all GitHub Actions are using SHA pinning

set -e

WORKFLOW_FILE=".github/workflows/ci.yml"
FAILED=0

echo "🔍 Verifying SHA pinning in $WORKFLOW_FILE"
echo "================================================"

# Check if workflow file exists
if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "❌ Workflow file not found: $WORKFLOW_FILE"
    exit 1
fi

# Expected SHAs
CHECKOUT_SHA="11bd71901bbe5b1630ceea73d27597364c9af683"
SETUP_NODE_SHA="39370e3970a6d050c480ffad4ff0ed4d3fdee5af"
CODECOV_SHA="9cc74bf7e13a810454a28846494ddbc3795eb693"
UPLOAD_ARTIFACT_SHA="b4b15b8c7c6ac21ea08fcf65892d2ee8f75cf882"

# Check actions/checkout
CHECKOUT_COUNT=$(grep -c "uses: actions/checkout@${CHECKOUT_SHA}" "$WORKFLOW_FILE" 2>/dev/null || true)
CHECKOUT_TOTAL=$(grep -c "uses: actions/checkout@" "$WORKFLOW_FILE" 2>/dev/null || true)
if [ "$CHECKOUT_TOTAL" -eq 0 ]; then
    echo "⚠️  Action not found: actions/checkout"
elif [ "$CHECKOUT_COUNT" -eq "$CHECKOUT_TOTAL" ]; then
    echo "✅ actions/checkout: All $CHECKOUT_COUNT occurrence(s) use SHA pinning"
else
    echo "❌ actions/checkout: Only $CHECKOUT_COUNT of $CHECKOUT_TOTAL occurrence(s) use SHA pinning"
    FAILED=1
fi

# Check actions/setup-node
SETUP_NODE_COUNT=$(grep -c "uses: actions/setup-node@${SETUP_NODE_SHA}" "$WORKFLOW_FILE" 2>/dev/null || true)
SETUP_NODE_TOTAL=$(grep -c "uses: actions/setup-node@" "$WORKFLOW_FILE" 2>/dev/null || true)
if [ "$SETUP_NODE_TOTAL" -eq 0 ]; then
    echo "⚠️  Action not found: actions/setup-node"
elif [ "$SETUP_NODE_COUNT" -eq "$SETUP_NODE_TOTAL" ]; then
    echo "✅ actions/setup-node: All $SETUP_NODE_COUNT occurrence(s) use SHA pinning"
else
    echo "❌ actions/setup-node: Only $SETUP_NODE_COUNT of $SETUP_NODE_TOTAL occurrence(s) use SHA pinning"
    FAILED=1
fi

# Check codecov/codecov-action
CODECOV_COUNT=$(grep -c "uses: codecov/codecov-action@${CODECOV_SHA}" "$WORKFLOW_FILE" 2>/dev/null || true)
CODECOV_TOTAL=$(grep -c "uses: codecov/codecov-action@" "$WORKFLOW_FILE" 2>/dev/null || true)
if [ "$CODECOV_TOTAL" -eq 0 ]; then
    echo "⚠️  Action not found: codecov/codecov-action"
elif [ "$CODECOV_COUNT" -eq "$CODECOV_TOTAL" ]; then
    echo "✅ codecov/codecov-action: All $CODECOV_COUNT occurrence(s) use SHA pinning"
else
    echo "❌ codecov/codecov-action: Only $CODECOV_COUNT of $CODECOV_TOTAL occurrence(s) use SHA pinning"
    FAILED=1
fi

# Check actions/upload-artifact
UPLOAD_COUNT=$(grep -c "uses: actions/upload-artifact@${UPLOAD_ARTIFACT_SHA}" "$WORKFLOW_FILE" 2>/dev/null || true)
UPLOAD_TOTAL=$(grep -c "uses: actions/upload-artifact@" "$WORKFLOW_FILE" 2>/dev/null || true)
if [ "$UPLOAD_TOTAL" -eq 0 ]; then
    echo "⚠️  Action not found: actions/upload-artifact"
elif [ "$UPLOAD_COUNT" -eq "$UPLOAD_TOTAL" ]; then
    echo "✅ actions/upload-artifact: All $UPLOAD_COUNT occurrence(s) use SHA pinning"
else
    echo "❌ actions/upload-artifact: Only $UPLOAD_COUNT of $UPLOAD_TOTAL occurrence(s) use SHA pinning"
    FAILED=1
fi

echo "================================================"

# Check for version tags (should be replaced with SHAs)
VERSION_TAGS=$(grep -E "uses: .+@v[0-9]+" "$WORKFLOW_FILE" 2>/dev/null || true)
if [ -n "$VERSION_TAGS" ]; then
    echo "❌ Found actions still using version tags:"
    echo "$VERSION_TAGS"
    FAILED=1
else
    echo "✅ No version tags found (all actions use SHA pinning)"
fi

# Check dependabot configuration
DEPENDABOT_FILE=".github/dependabot.yml"
if [ -f "$DEPENDABOT_FILE" ]; then
    if grep -q "package-ecosystem.*github-actions" "$DEPENDABOT_FILE" 2>/dev/null; then
        echo "✅ Dependabot configured for GitHub Actions"
    else
        echo "⚠️  Dependabot file exists but GitHub Actions not configured"
    fi
else
    echo "⚠️  Dependabot configuration not found at $DEPENDABOT_FILE"
fi

echo "================================================"

if [ "$FAILED" -eq 0 ]; then
    echo "✅ All SHA pinning checks passed!"
    exit 0
else
    echo "❌ Some SHA pinning checks failed"
    exit 1
fi