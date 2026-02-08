#!/bin/bash
# =============================================================================
# Backend Test Script with Database
# =============================================================================
# Starts the test database and runs backend tests.
#
# Usage:
#   ./scripts/test-with-db.sh           # Start DB and run tests
#   ./scripts/test-with-db.sh --ci      # Run with coverage
#   ./scripts/test-with-db.sh --keep    # Keep DB running after tests
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="../../docker/docker-compose.test.yml"
SERVICE_NAME="test-db"
DB_NAME="weft-test-postgres"
TEST_PORT="5433"

# Parse arguments
KEEP_DB=false
RUN_COVERAGE=false
TEST_ARGS=""

for arg in "$@"; do
  case $arg in
    --keep)
      KEEP_DB=true
      shift
      ;;
    --ci)
      RUN_COVERAGE=true
      shift
      ;;
    *)
      TEST_ARGS="$TEST_ARGS $arg"
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

# Main script logic
main() {
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}         Weft Backend Test Runner with Database${NC}"
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

  echo ""
  echo -e "${BLUE}Running backend tests...${NC}"
  echo ""

  # Set test environment variables (using port 5433 for local testing)
  export NODE_ENV=test
  export DATABASE_URL="postgresql://weft_test:weft_test_password@localhost:$TEST_PORT/weft_test"
  export PORT=3001
  export BETTER_AUTH_SECRET="test-secret-key-for-local-testing-at-least-32-chars"
  export BETTER_AUTH_URL="http://localhost:3001"
  export BETTER_AUTH_APP_URL="http://localhost:3000"

  # Build shared package first
  echo -e "${BLUE}Building shared package...${NC}"
  pnpm --filter @weft/shared build

  # Run migrations
  echo -e "${BLUE}Running database migrations...${NC}"
  pnpm --filter @weft/server db:migrate

  # Run tests
  if [ "$RUN_COVERAGE" = true ]; then
    echo -e "${BLUE}Running tests with coverage...${NC}"
    pnpm --filter @weft/server test:ci
  else
    echo -e "${BLUE}Running tests...${NC}"
    pnpm --filter @weft/server test:run $TEST_ARGS
  fi

  TEST_EXIT_CODE=$?

  echo ""
  if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}                    ✓ All tests passed!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  else
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}                    ✗ Some tests failed${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
  fi

  exit $TEST_EXIT_CODE
}

main
