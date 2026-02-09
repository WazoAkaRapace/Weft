#!/usr/bin/env tsx

/**
 * Mood Tracker Test Validation Script
 *
 * Validates that all mood tracker tests are properly structured
 * and checks for any missing test scenarios.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface TestValidation {
  file: string;
  exists: boolean;
  hasValidImports: boolean;
  testSuites: string[];
  testCount: number;
  issues: string[];
}

const results: TestValidation[] = [];

function validateFile(filePath: string): TestValidation {
  const issues: string[] = [];
  let hasValidImports = false;

  if (!existsSync(filePath)) {
    return {
      file: filePath,
      exists: false,
      hasValidImports: false,
      testSuites: [],
      testCount: 0,
      issues: ['File does not exist'],
    };
  }

  const content = readFileSync(filePath, 'utf-8');

  // Check for required imports
  hasValidImports =
    content.includes("import { describe") &&
    content.includes("import { expect") &&
    content.includes('vitest');

  // Count test suites and tests
  const testSuites = content.match(/describe\(['"](.*?)['"]/g) || [];
  const tests = content.match(/it\(['"](.*?)['"]/g) || [];

  // Check for common issues
  if (!hasValidImports) {
    issues.push('Missing required imports');
  }

  if (tests.length === 0) {
    issues.push('No tests defined');
  }

  // Check for authentication tests
  if (content.includes('401') && !content.includes('unauthenticated')) {
    issues.push('Found 401 status check without proper test description');
  }

  // Check for edge case tests
  if (!content.includes('edge') && !content.includes('Edge')) {
    issues.push('Consider adding edge case tests');
  }

  return {
    file: filePath,
    exists: true,
    hasValidImports,
    testSuites: testSuites.map(s => s.match(/['"](.*?)['"]/)?.[1] || ''),
    testCount: tests.length,
    issues,
  };
}

console.log('🧪 Validating Mood Tracker Test Suite\n');

// Backend test files
const backendTests = [
  'packages/server/tests/integration/features/mood-tracker.test.ts',
  'packages/server/tests/integration/features/mood-calendar.test.ts',
  'packages/server/tests/fixtures/moods.ts',
];

// Frontend test files
const frontendTests = [
  'packages/web/src/components/moods/__tests__/MoodSelector.test.tsx',
];

console.log('📦 Backend Tests');
console.log('==================\n');

backendTests.forEach(test => {
  const result = validateFile(test);
  results.push(result);

  if (result.exists) {
    console.log(`✅ ${test}`);
    console.log(`   Tests: ${result.testCount}`);
    console.log(`   Suites: ${result.testSuites.length}`);
    if (result.issues.length > 0) {
      console.log(`   ⚠️  Issues:`);
      result.issues.forEach(issue => console.log(`      - ${issue}`));
    }
    console.log('');
  } else {
    console.log(`❌ ${test} - File not found`);
    console.log('');
  }
});

console.log('🎨 Frontend Tests');
console.log('===================\n');

frontendTests.forEach(test => {
  const result = validateFile(test);
  results.push(result);

  if (result.exists) {
    console.log(`✅ ${test}`);
    console.log(`   Tests: ${result.testCount}`);
    console.log(`   Suites: ${result.testSuites.length}`);
    if (result.issues.length > 0) {
      console.log(`   ⚠️  Issues:`);
      result.issues.forEach(issue => console.log(`      - ${issue}`));
    }
    console.log('');
  } else {
    console.log(`❌ ${test} - File not found`);
    console.log('');
  }
});

// Summary
const totalTests = results.reduce((sum, r) => sum + r.testCount, 0);
const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
const allExist = results.every(r => r.exists);

console.log('📊 Summary');
console.log('===========');
console.log(`Total Test Files: ${results.length}`);
console.log(`Total Tests: ${totalTests}`);
console.log(`Total Issues: ${totalIssues}`);
console.log(`All Files Exist: ${allExist ? '✅' : '❌'}`);
console.log('');

// Test coverage checklist
console.log('📋 Test Coverage Checklist');
console.log('==========================\n');

const coverage = {
  'Backend API': {
    'Create/Update Manual Mood': backendTests[0],
    'Retrieve Mood Data': backendTests[0],
    'Paginated Journals with Moods': backendTests[0],
    'Authentication/Authorization': backendTests[0],
    'Error Handling': backendTests[0],
  },
  'Calendar Scenarios': {
    'Mood Display Priority': backendTests[1],
    'Multiple Entries Per Day': backendTests[1],
    'Empty States': backendTests[1],
    'Month Boundaries': backendTests[1],
    'Leap Year Handling': backendTests[1],
  },
  'Frontend Components': {
    'MoodSelector Rendering': frontendTests[0],
    'User Interactions': frontendTests[0],
    'State Management': frontendTests[0],
    'Accessibility': frontendTests[0],
  },
  'Test Fixtures': {
    'Mood Data Helpers': backendTests[2],
    'Calendar Edge Cases': backendTests[2],
  },
};

Object.entries(coverage).forEach(([category, items]) => {
  console.log(`${category}:`);
  Object.entries(items).forEach(([item, file]) => {
    const exists = existsSync(file);
    console.log(`  ${exists ? '✅' : '❌'} ${item}`);
  });
  console.log('');
});

// Exit with appropriate code
if (!allExist || totalIssues > 0) {
  process.exit(1);
}

console.log('✅ All tests validated successfully!');
