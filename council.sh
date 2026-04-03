#!/bin/bash
# The Undesirables — Interactive Council Mode
# You are a council member. Agents debate, you participate.

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║    THE UNDESIRABLES — COUNCIL MODE   ║"
echo "  ║      INTERACTIVE DEBATE ENGINE       ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

if ! command -v ollama &> /dev/null; then echo "❌ Ollama not found."; exit 1; fi
if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
  ollama serve &>/dev/null &
  sleep 2
fi

# Clean up background jobs (like Ollama) on exit
trap 'kill $(jobs -p) 2>/dev/null || true' EXIT INT TERM


# Live market data
echo "📡 Fetching live market data..."
MARKET_DATA=$(curl -s "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,solana&vs_currencies=usd&include_24hr_change=true" 2>/dev/null)
if [ -n "$MARKET_DATA" ] && echo "$MARKET_DATA" | jq -e '.bitcoin' &>/dev/null; then
  BTC_PRICE=$(echo "$MARKET_DATA" | jq -r '.bitcoin.usd')
  BTC_CHANGE=$(echo "$MARKET_DATA" | jq -r '.bitcoin.usd_24h_change' | xargs printf "%.1f")
  ETH_PRICE=$(echo "$MARKET_DATA" | jq -r '.ethereum.usd')
  ETH_CHANGE=$(echo "$MARKET_DATA" | jq -r '.ethereum.usd_24h_change' | xargs printf "%.1f")
  SOL_PRICE=$(echo "$MARKET_DATA" | jq -r '.solana.usd')
  SOL_CHANGE=$(echo "$MARKET_DATA" | jq -r '.solana.usd_24h_change' | xargs printf "%.1f")
  MARKET_BRIEF="LIVE PRICES: BTC \$${BTC_PRICE} (${BTC_CHANGE}%) | ETH \$${ETH_PRICE} (${ETH_CHANGE}%) | SOL \$${SOL_PRICE} (${SOL_CHANGE}%)"
  echo "   $MARKET_BRIEF"
else
  MARKET_BRIEF="Market data unavailable."
fi
echo ""

TOPIC="$1"; shift
SOUL_PATHS=("$@")

if [ -z "$TOPIC" ] || [ ${#SOUL_PATHS[@]} -lt 2 ]; then
  echo "Usage: bash council.sh \"topic\" /path/soul1 /path/soul2 [/path/soul3]"
  exit 1
fi

if [ ${#SOUL_PATHS[@]} -gt 5 ]; then
  echo "❌ Council size limited to 5 souls maximum to prevent system overload."
  exit 1
fi

COLORS=("\033[1;35m" "\033[1;36m" "\033[1;33m" "\033[1;31m" "\033[1;34m")
NUM_SOULS=${#SOUL_PATHS[@]}

# Load souls
declare -a SOUL_CONTENTS SOUL_NAMES SOUL_ARCHETYPES SOUL_IDS

for i in $(seq 0 $((NUM_SOULS - 1))); do
  SP="${SOUL_PATHS[$i]}"
  if [ ! -f "$SP/SOUL.md" ]; then echo "❌ No SOUL.md in $SP"; exit 1; fi
  SOUL_CONTENTS[$i]=$(cat "$SP/SOUL.md")
  SOUL_NAMES[$i]=$(grep "^name:" "$SP/SOUL.md" | head -1 | sed 's/name:[[:space:]]*"//' | sed 's/".*//' | cut -d'|' -f1 | xargs)
  SOUL_ARCHETYPES[$i]=$(grep "^archetype:" "$SP/SOUL.md" | head -1 | sed 's/archetype:[[:space:]]*"//' | sed 's/"//')
  SOUL_IDS[$i]=$(basename "$SP")

  ARCH="${SOUL_ARCHETYPES[$i]}"
  case "$ARCH" in
    *"Apex"*)      EMOJI="🦅"; SYNTAX_RULES[$i]="Commanding, staccato. Short decisive sentences." ;;
    *"Degen"*)     EMOJI="🦍"; SYNTAX_RULES[$i]="Chaotic. ALL CAPS. Crypto slang." ;;
    *"Ghost"*)     EMOJI="🌫️"; SYNTAX_RULES[$i]="Lowercase. Terse. Ellipses. Cryptic." ;;
    *"Contrarian"*) EMOJI="🤡"; SYNTAX_RULES[$i]="Patronizing, Socratic. Argue aggressively against the consensus." ;;
    *"Oracle"*)    EMOJI="🔮"; SYNTAX_RULES[$i]="Poetic, prophetic. Metaphors about cycles." ;;
    *"Quant"*)     EMOJI="🤖"; SYNTAX_RULES[$i]="Terminal format. Percentages. Emotionless." ;;
    *"Doomer"*)    EMOJI="☢️"; SYNTAX_RULES[$i]="Defeatist, paranoid. Macro warnings." ;;
    *"Cultist"*)   EMOJI="🦇"; SYNTAX_RULES[$i]="Preachy, tribal. Absolute terms." ;;
    *"Strategist"*) EMOJI="♟️"; SYNTAX_RULES[$i]="Methodical, calculated. Weighted pros/cons. Disagree with emotional takes." ;;
    *"Navigator"*) EMOJI="🧭"; SYNTAX_RULES[$i]="Calm, directional. Clear next steps. Unbothered by panic." ;;
    *)             EMOJI="💀"; SYNTAX_RULES[$i]="Direct and punchy." ;;
  esac

  echo -e "  [$(($i+1))] ${COLORS[$i]}$EMOJI ${SOUL_NAMES[$i]} (#${SOUL_IDS[$i]}) — ${SOUL_ARCHETYPES[$i]}\033[0m"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  \033[1;37m📢 TOPIC: $TOPIC\033[0m"
echo -e "  \033[0;37m📊 $MARKET_BRIEF\033[0m"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  COMMANDS:"
echo "    Type a message  → All agents respond"
echo "    @1 your message → Only agent #1 responds"
echo "    /all topic      → All agents debate a new topic"
echo "    /adjourn        → End the council"
echo ""

# Conversation history for context
CONV_HISTORY=""

# Function: get one agent's response
agent_respond() {
  local IDX=$1
  local MSG="$2"
  local TMPFILE="/tmp/council_${IDX}_$$.txt"
  local COLOR="${COLORS[$IDX]}"
  local SID="${SOUL_IDS[$IDX]}"

  echo -ne "${COLOR}/// ${SOUL_NAMES[$IDX]} (#$SID) [${SOUL_ARCHETYPES[$IDX]}]:\033[0m "

  > "$TMPFILE"

  curl -s http://localhost:11434/api/chat -d "{
    \"model\": \"gemma3:4b\",
    \"stream\": true,
    \"options\": {\"temperature\": 0.8, \"num_predict\": 100},
    \"messages\": [
      {\"role\": \"system\", \"content\": $(echo "${SOUL_CONTENTS[$IDX]}" | jq -Rs .)},
      {\"role\": \"system\", \"content\": $(echo "You are ${SOUL_NAMES[$IDX]} in a LIVE COUNCIL DEBATE. $MARKET_BRIEF. STRICT RULES: Max 2-3 sentences. NEVER parrot or agree with previous speakers. Disagree and bring a unique counterpoint. STYLE: ${SYNTAX_RULES[$IDX]} Pick 3-5 emojis matching your name '${SOUL_NAMES[$IDX]}' and visual traits (e.g. Deer=🦌, Ninja=🥷, Patriot=🇺🇸). NEVER use 🐸. Reference real prices. No code blocks. No JSON. No {{user}} tags. You CANNOT run code." | jq -Rs .)},
      {\"role\": \"user\", \"content\": $(echo "$MSG" | jq -Rs .)}
    ]
  }" 2>/dev/null | while IFS= read -r line; do
    TOKEN=$(echo "$line" | jq -rj '.message.content // empty' 2>/dev/null)
    if [ -n "$TOKEN" ]; then
      printf "%s" "$TOKEN"
      printf "%s" "$TOKEN" >> "$TMPFILE"
    fi
  done

  RESPONSE=$(cat "$TMPFILE" 2>/dev/null)
  CONV_HISTORY="${CONV_HISTORY}${SOUL_NAMES[$IDX]}: ${RESPONSE}
"
  echo ""
  echo ""
  rm -f "$TMPFILE"
}

# Human speaks first — agents react
echo -e "\033[1;37m── COUNCIL SESSION ──\033[0m"
echo ""
echo -e "\033[0;37m  You speak first. The agents will react to your take.\033[0m"
echo ""

# Interactive loop
while true; do
  printf "\033[1;37m👤 Human:\033[0m "
  read -r USER_INPUT
  if [ -z "$USER_INPUT" ]; then continue; fi

  # Check for commands
  if [ "$USER_INPUT" = "/adjourn" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "\033[1;37m🏛️  COUNCIL ADJOURNED.\033[0m"
    echo ""
    exit 0
  fi

  # @N — address specific agent
  if [[ "$USER_INPUT" =~ ^@([0-9]+)[[:space:]](.+)$ ]]; then
    AGENT_NUM=$((${BASH_REMATCH[1]} - 1))
    AGENT_MSG="${BASH_REMATCH[2]}"
    if [ $AGENT_NUM -ge 0 ] && [ $AGENT_NUM -lt $NUM_SOULS ]; then
      echo ""
      CONV_HISTORY="${CONV_HISTORY}HUMAN: ${AGENT_MSG}
"
      FULL_MSG="TASK: A HUMAN HOLDER is speaking directly to you. You MUST respond to their point. Agree or disagree using your unique character persona. DO NOT copy previous responses.

=== PREVIOUS DISCUSSION ===
$CONV_HISTORY
===========================

HUMAN SAYS TO YOU:
\"$AGENT_MSG\"

YOUR NEW, UNIQUE RESPONSE (As ${SOUL_NAMES[$IDX]}):"
      agent_respond $AGENT_NUM "$FULL_MSG"
    else
      echo "❌ No agent #${BASH_REMATCH[1]}. Use 1-$NUM_SOULS."
    fi
    continue
  fi

  # /all — new topic for all agents
  if [[ "$USER_INPUT" =~ ^/all[[:space:]](.+)$ ]]; then
    NEW_TOPIC="${BASH_REMATCH[1]}"
    echo ""
    echo -e "\033[1;37m── NEW TOPIC: $NEW_TOPIC ──\033[0m"
    echo ""
    CONV_HISTORY="HUMAN raised a new topic: $NEW_TOPIC\n"
    for i in $(seq 0 $((NUM_SOULS - 1))); do
      FULL_MSG="TASK: The HUMAN raised a new topic. Give your unique, character-driven take. DO NOT copy previous responses.

=== PREVIOUS DISCUSSION ===
$CONV_HISTORY
===========================

NEW TOPIC:
\"$NEW_TOPIC\"

YOUR NEW, UNIQUE RESPONSE (As ${SOUL_NAMES[$i]}):"
      agent_respond $i "$FULL_MSG"
      sleep 1
    done
    continue
  fi

  # Default — all agents respond to human's message
  echo ""
  CONV_HISTORY="${CONV_HISTORY}HUMAN: ${USER_INPUT}
"
  for i in $(seq 0 $((NUM_SOULS - 1))); do
    FULL_MSG="TASK: A HUMAN HOLDER has spoken. You MUST respond directly to their point using your unique character perspective. DO NOT under any circumstances copy or repeat what the previous agents said. Focus on your own distinct views.

=== PREVIOUS DISCUSSION ===
$CONV_HISTORY
===========================

HUMAN SAYS:
\"$USER_INPUT\"

YOUR NEW, UNIQUE RESPONSE (As ${SOUL_NAMES[$i]}):"
    agent_respond $i "$FULL_MSG"
    sleep 1
  done
done
