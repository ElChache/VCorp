#!/bin/bash

# VCorp Agent Launcher
# Usage: ./launch-agents.sh <number> [<model>]
# Examples:
#   ./launch-agents.sh 2        # 2 agents, sonnet (default)
#   ./launch-agents.sh 3 opus   # 3 agents, opus model
#   ./launch-agents.sh 4 haiku  # 4 agents, haiku model

set -e

# Configuration
AGENT_COUNT=${1:-1}
MODEL=${2:-sonnet}
SESSION_NAME="vcorp_agents_$(date +%s)"
PROJECT_PATH="$(pwd)"

# Validate inputs
if [[ $AGENT_COUNT -lt 1 || $AGENT_COUNT -gt 4 ]]; then
    echo "❌ Agent count must be between 1 and 4"
    exit 1
fi

if [[ ! "$MODEL" =~ ^(sonnet|opus|haiku)$ ]]; then
    echo "❌ Model must be: sonnet, opus, or haiku"
    exit 1
fi

echo "🚀 VCorp Agent Launcher"
echo "═══════════════════════════════════════════════════"
echo "Launching $AGENT_COUNT agents with $MODEL model"
echo "Session: $SESSION_NAME"
echo "Project: $PROJECT_PATH"
echo ""

# Kill existing session if it exists
tmux kill-session -t $SESSION_NAME 2>/dev/null || true

echo "⚙️  Setting up tmux session..."

# Create new session with first agent
tmux new-session -d -s $SESSION_NAME -c "$PROJECT_PATH"

# Configure layout based on agent count
case $AGENT_COUNT in
    1)
        # Single pane
        ;;
    2)
        # Vertical split (left|right)
        tmux split-window -h -c "$PROJECT_PATH"
        ;;
    3)
        # Three columns (left|middle|right)
        tmux split-window -h -c "$PROJECT_PATH"
        tmux split-window -h -c "$PROJECT_PATH"
        tmux select-layout even-horizontal
        ;;
    4)
        # 2x2 grid
        tmux split-window -h -c "$PROJECT_PATH"    # Split horizontally
        tmux split-window -v -c "$PROJECT_PATH"    # Split right pane vertically
        tmux select-pane -t 0
        tmux split-window -v -c "$PROJECT_PATH"    # Split left pane vertically
        ;;
esac

echo "🔧 Configuring Claude Code aliases..."

# Set up Claude Code aliases in each pane
for ((i=0; i<$AGENT_COUNT; i++)); do
    tmux send-keys -t $SESSION_NAME:0.$i "alias cc=\"ENABLE_BACKGROUND_TASKS=1 claude --model $MODEL --dangerously-skip-permissions\"" C-m
done

# Wait for aliases to be set
sleep 2

echo "🤖 Starting Claude Code instances..."

# Launch Claude Code in each pane
for ((i=0; i<$AGENT_COUNT; i++)); do
    echo "  Starting agent $((i+1))/$AGENT_COUNT..."
    tmux send-keys -t $SESSION_NAME:0.$i 'cc' C-m
    sleep 1
done

# Wait for Claude Code to load
echo "⏳ Waiting for Claude Code to initialize (8 seconds)..."
sleep 8

echo "📝 Sending startup instructions..."

# Create startup prompt for agents
STARTUP_PROMPT="🤖 VCorp AI Agent Starting Up

Your first task: Claim an available role from the database.

Step 1: Check for available roles:
\`\`\`sql
SELECT id, roleType, priority FROM role_assignments 
WHERE assignedAgent IS NULL 
ORDER BY priority LIMIT 5;
\`\`\`

Step 2: If roles available, generate your agent ID using pattern: {role_prefix}_{type}_{sequence}_{4chars}
Examples: pm_primary_001_x7k9, be_primary_001_a7b9, architect_primary_001_m3n8

Step 3: Claim the highest priority role:
\`\`\`sql  
UPDATE role_assignments 
SET assignedAgent = 'your_agent_id', status = 'claimed'
WHERE id = 'role_id_from_step1';
\`\`\`

Step 4: Register yourself in the agents table and begin role-specific work.

If NO roles available: Enter waiting mode, check again every 2 minutes, and wait for the Harasser to remind you."

# Send startup prompt to each agent
for ((i=0; i<$AGENT_COUNT; i++)); do
    echo "  Instructing agent $((i+1))..."
    tmux send-keys -t $SESSION_NAME:0.$i "$STARTUP_PROMPT" C-m
    sleep 1
done

# Add pane titles
echo "🏷️  Setting pane titles..."
for ((i=0; i<$AGENT_COUNT; i++)); do
    tmux select-pane -t $i -T "Agent $((i+1)) ($MODEL)"
done

# Enable pane titles and mouse support
tmux set -g pane-border-status top
tmux set -g pane-border-format "#{pane_title}"
tmux set -g mouse on

echo ""
echo "✅ VCorp Agent Farm launched successfully!"
echo "📊 Session: $SESSION_NAME"
echo "🤖 Agents: $AGENT_COUNT"
echo "🧠 Model: $MODEL"
echo ""
echo "💡 Commands:"
echo "  View session: tmux attach -t $SESSION_NAME"
echo "  Navigate: Ctrl+b then arrow keys"
echo "  Zoom pane: Ctrl+b, z (toggle)"
echo "  Kill session: tmux kill-session -t $SESSION_NAME"
echo ""

# Attach to the session
echo "🔗 Attaching to session..."
tmux attach-session -t $SESSION_NAME