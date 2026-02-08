#!/bin/bash
# =============================================================================
# Weft Local Test Runner
# =============================================================================
# Runs all tests locally with database support.
#
# Usage:
#   ./scripts/test-local.sh           # Run all tests
#   ./scripts/test-local.sh --backend # Run backend tests only
#   ./scripts/test-local.sh --frontend # Run frontend tests only
#   ./scripts/test-local.sh --ci      # Run with coverage
#   ./scripts/test-local.sh --keep    # Keep database running
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker/docker-compose.test.yml"
SERVICE_NAME="test-db"
DB_NAME="weft-test-postgres"
TEST_PORT="5433"

# Parse arguments
RUN_BACKEND=true
RUN_FRONTEND=true
KEEP_DB=false
RUN_COVERAGE=false

for arg in "$@"; do
  case $arg in
    --backend)
      RUN_FRONTEND=false
      shift
      ;;
    --frontend)
      RUN_BACKEND=false
      shift
      ;;
    --keep)
      KEEP_DB=true
      shift
      ;;
    --ci)
      RUN_COVERAGE=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --backend    Run backend tests only"
      echo "  --frontend   Run frontend tests only"
      echo "  --ci         Run with coverage"
      echo "  --keep       Keep database running after tests"
      echo "  --help       Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Function to check if database is running
is_db_running() {
  docker ps --filter "name=$DB_NAME" --format '{{.Names}}' | grep -q "$DB_NAME"
}

# Function to wait for database to be healthy
wait_for_db() {
  echo -e "${BLUE}Waiting for database to be healthy...${NC}"

  local max_attempts=30
  local attempt=0

  while [ $attempt -lt $max_attempts ]; do
    if docker exec "$DB_NAME" pg_isready -U weft_test -d weft_test > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Database is ready!${NC}"
      return 0
    fi

    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
  done

  echo -e "\n${RED}✗ Database failed to start${NC}"
  return 1
}

# Function to cleanup database
cleanup_db() {
  if [ "$KEEP_DB" = false ]; then
    echo -e "${YELLOW}Stopping test database...${NC}"
    docker compose -f "$COMPOSE_FILE" down
    echo -e "${GREEN}✓ Database stopped${NC}"
  else
    echo -e "${YELLOW}Database kept running. Stop it with:${NC}"
    echo "  docker compose -f $COMPOSE_FILE down"
  fi
}

# Trap to ensure cleanup happens
trap cleanup_db EXIT INT TERM

# Start database if backend tests are needed
if [ "$RUN_BACKEND" = true ]; then
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}              Weft Local Test Runner${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  echo ""

  # Check if database is already running
  if is_db_running; then
    echo -e "${GREEN}✓ Test database is already running${NC}"
  else
    # Start the database
    echo -e "${BLUE}Starting test database on port $TEST_PORT...${NC}"
    docker compose -f "$COMPOSE_FILE" up -d

    # Wait for database to be healthy
    if ! wait_for_db; then
      echo -e "${RED}Failed to start database. Check logs with:${NC}"
      echo "  docker logs $DB_NAME"
      exit 1
    fi
  fi
fi

OVERALL_EXIT_CODE=0

# Run backend tests
if [ "$RUN_BACKEND" = true ]; then
  echo ""
  echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"
  echo -e "${BLUE}                    Backend Tests${NC}"
  echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"

  # Set test environment variables (using port 5433 for local testing)
  export NODE_ENV=test
  export DATABASE_URL="postgresql://weft_test:weft_test_password@localhost:$TEST_PORT/weft_test"
  export PORT=3001
  export BETTER_AUTH_SECRET="test-secret-key-for-local-testing-at-least-32-chars"
  export BETTER_AUTH_URL="http://localhost:3001"
  export BETTER_AUTH_APP_URL="http://localhost:3000"

  # Build shared package
  echo -e "${BLUE}Building shared package...${NC}"
  pnpm --filter @weft/shared build

  # Run migrations
  echo -e "${BLUE}Running database migrations...${NC}"
  pnpm --filter @weft/server db:migrate

  # Run tests
  if [ "$RUN_COVERAGE" = true ]; then
    echo -e "${BLUE}Running tests with coverage...${NC}"
    pnpm --filter @weft/server test:ci || OVERALL_EXIT_CODE=$?
  else
    echo -e "${BLUE}Running tests...${NC}"
    pnpm --filter @weft/server test:run || OVERALL_EXIT_CODE=$?
  fi

  if [ $OVERALL_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ Backend tests passed${NC}"
  else
    echo -e "${RED}✗ Backend tests failed${NC}"
  fi
fi

# Run frontend tests
if [ "$RUN_FRONTEND" = true ]; then
  echo ""
  echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"
  echo -e "${BLUE}                   Frontend Tests${NC}"
  echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"

  # Set frontend test environment
  export NODE_ENV=test
  export VITE_API_URL="http://localhost:3001"

  # Build shared package
  echo -e "${BLUE}Building shared package...${NC}"
  pnpm --filter @weft/shared build

  # Run tests
  if [ "$RUN_COVERAGE" = true ]; then
    echo -e "${BLUE}Running tests with coverage...${NC}"
    pnpm --filter @weft/web test:run --coverage || OVERALL_EXIT_CODE=$?
  else
    echo -e "${BLUE}Running tests...${NC}"
    pnpm --filter @weft/web test:run || OVERALL_EXIT_CODE=$?
  fi

  if [ $OVERALL_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend tests passed${NC}"
  else
    echo -e "${RED}✗ Frontend tests failed${NC}"
  fi
fi

# Print summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
if [ $OVERALL_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}                    ✓ All tests passed!${NC}"
else
  echo -e "${RED}                    ✗ Some tests failed${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

exit $OVERALL_EXIT_CODE
