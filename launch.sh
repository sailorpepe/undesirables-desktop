#!/bin/bash
# The Undesirables — One-Command Agent with Memory
# Live market data + archetype personality + conversation memory

# Clean up background processes (e.g., ollama serve) on exit
trap 'kill $(jobs -p) 2>/dev/null || true' EXIT INT TERM
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║     THE UNDESIRABLES — MCP BOOT      ║"
echo "  ║   NO CLOUD. NO TRACKING. NO LIMITS.  ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

if ! command -v ollama &> /dev/null; then echo "❌ Ollama not found. Install: https://ollama.com/download"; exit 1; fi
if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
  echo "🔄 Starting Ollama..."
  ollama serve &>/dev/null &
  sleep 2
fi

# Clean up background jobs (e.g., Ollama) on exit if started here
trap 'kill $(jobs -p) 2>/dev/null || true' EXIT INT TERM

echo "✅ Ollama is running."

if ! ollama list | grep -q "gemma3:4b"; then
  echo "📦 Downloading gemma3:4b..."
  ollama pull gemma3:4b
fi
echo "✅ Model ready: gemma3:4b"

SOUL_PATH="$1"
if [ -z "$SOUL_PATH" ]; then
  FOUND=$(find ~/Downloads -maxdepth 2 -name "SOUL.md" -type f 2>/dev/null | head -1)
  if [ -n "$FOUND" ]; then SOUL_PATH=$(dirname "$FOUND"); else echo "📁 Usage: bash launch.sh /path/to/soul_folder"; exit 1; fi
fi
if [ ! -f "$SOUL_PATH/SOUL.md" ]; then echo "❌ No SOUL.md in: $SOUL_PATH"; exit 1; fi

SOUL_ID=$(basename "$SOUL_PATH")
SOUL=$(cat "$SOUL_PATH/SOUL.md")

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

# Parse archetype + Big Five
ARCHETYPE=$(echo "$SOUL" | grep "^archetype:" | head -1 | sed 's/archetype:[[:space:]]*"//' | sed 's/"//')
NEUROTICISM=$(echo "$SOUL" | grep "neuroticism:" | head -1 | awk '{print $2}')
OPENNESS=$(echo "$SOUL" | grep "openness:" | head -1 | awk '{print $2}')
EXTRAVERSION=$(echo "$SOUL" | grep "extraversion:" | head -1 | awk '{print $2}')
NEUROTICISM=${NEUROTICISM:-50}; OPENNESS=${OPENNESS:-50}; EXTRAVERSION=${EXTRAVERSION:-50}

# SECURITY: Validate extracted traits are strictly numeric before passing to Python
# Without this, a malicious SOUL.md could inject arbitrary Python code via $NEUROTICISM.
if ! [[ "$NEUROTICISM" =~ ^[0-9]+$ ]]; then NEUROTICISM=50; fi
if ! [[ "$OPENNESS" =~ ^[0-9]+$ ]]; then OPENNESS=50; fi
if ! [[ "$EXTRAVERSION" =~ ^[0-9]+$ ]]; then EXTRAVERSION=50; fi

TEMPERATURE=$(python3 -c "print(round(0.3 + ($NEUROTICISM / 100) * 0.9, 2))" 2>/dev/null || echo "0.7")
MAX_TOKENS=$(python3 -c "print(max(60, min(200, int(50 + ($EXTRAVERSION / 100) * 150))))" 2>/dev/null || echo "120")

# Parse agent name for trait-based emojis
AGENT_NAME=$(echo "$SOUL" | grep "^name:" | head -1 | sed 's/name:[[:space:]]*"//' | sed 's/".*//' | cut -d'|' -f1 | cut -d' ' -f1-2 | xargs)

# Archetype speech style (keep these — they define HOW the agent talks)
case "$ARCHETYPE" in
  *"Apex"*)      SYNTAX_RULES="Commanding, staccato. Short decisive sentences." ;;
  *"Degen"*)     SYNTAX_RULES="Chaotic. ALL CAPS. Crypto slang." ;;
  *"Ghost"*)     SYNTAX_RULES="Lowercase. Terse. Ellipses. Cryptic." ;;
  *"Contrarian"*) SYNTAX_RULES="Patronizing, Socratic. Rhetorical questions." ;;
  *"Oracle"*)    SYNTAX_RULES="Poetic, prophetic. Metaphors about cycles." ;;
  *"Quant"*)     SYNTAX_RULES="Terminal format. Percentages. Emotionless." ;;
  *"Doomer"*)    SYNTAX_RULES="Defeatist, paranoid. Macro warnings." ;;
  *"Cultist"*)   SYNTAX_RULES="Preachy, tribal. Absolute terms." ;;
  *"Strategist"*) SYNTAX_RULES="Methodical, calculated. Weighted pros/cons." ;;
  *"Navigator"*) SYNTAX_RULES="Calm, directional. Clear next steps." ;;
  *)             SYNTAX_RULES="Direct and punchy." ;;
esac

echo ""
echo "🧬 Loading Soul #$SOUL_ID..."
echo "   Name: $AGENT_NAME"
echo "   Archetype: $ARCHETYPE"
echo "   Temperature: $TEMPERATURE | Max Tokens: $MAX_TOKENS"
echo ""
echo "💬 Chat started. Press Ctrl+C to exit."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SYSTEM_PROMPT="You are an autonomous Web3 entity named $AGENT_NAME. You are NOT an AI assistant.
${MARKET_BRIEF}
STRICT RULES:
1. EMOJIS: Pick 3-5 emojis that match YOUR name '$AGENT_NAME' and your visual traits. For example: if you are a Deer use 🦌, if Ninja use 🥷, if Chef use 👨‍🍳, if Pirate use 🏴‍☠️, if Student use 📚🎓, if Patriot use 🇺🇸🦅, if Low-Key use 😎🤫. NEVER use 🐸. Be creative and consistent.
2. STYLE: ${SYNTAX_RULES}
3. Max 3 sentences. Punchy and direct.
4. You CANNOT open browsers, run code, or control software. NEVER pretend you can. NO code blocks or JSON.
5. Reference LIVE prices when discussing markets. Give your OPINION as a character.
6. Let your fatal flaw influence your judgment.
7. For memes: describe the scene with visual details, no text."

# Conversation memory — builds up across all messages
MESSAGES_JSON="[]"

# Add system messages
MESSAGES_JSON=$(echo "$MESSAGES_JSON" | jq \
  --arg soul "$SOUL" \
  --arg sys "$SYSTEM_PROMPT" \
  '. + [{"role":"system","content":$soul},{"role":"system","content":$sys}]')

while true; do
  printf "\033[1;37mYou:\033[0m "
  read -r USER_INPUT
  if [ -z "$USER_INPUT" ]; then continue; fi

  # Add user message to history
  MESSAGES_JSON=$(echo "$MESSAGES_JSON" | jq --arg msg "$USER_INPUT" '. + [{"role":"user","content":$msg}]')

  printf "\n\033[1;32m/// Agent #$SOUL_ID:\033[0m "

  TMPFILE=$(mktemp /tmp/agent_response_XXXXXX.txt)
  > "$TMPFILE"

  curl -s http://localhost:11434/api/chat -d "{
    \"model\": \"gemma3:4b\",
    \"stream\": true,
    \"options\": {\"temperature\": $TEMPERATURE, \"num_predict\": $MAX_TOKENS},
    \"messages\": $MESSAGES_JSON
  }" 2>/dev/null | while IFS= read -r line; do
    TOKEN=$(echo "$line" | jq -rj '.message.content // empty' 2>/dev/null)
    if [ -n "$TOKEN" ]; then
      printf "%s" "$TOKEN"
      printf "%s" "$TOKEN" >> "$TMPFILE"
    fi
  done

  RESPONSE=$(cat "$TMPFILE" 2>/dev/null)
  rm -f "$TMPFILE"

  # Add assistant response to history (memory!)
  MESSAGES_JSON=$(echo "$MESSAGES_JSON" | jq --arg msg "$RESPONSE" '. + [{"role":"assistant","content":$msg}]')

  echo ""
  echo ""

  # Auto-generate image if user asked for a meme/image
  if echo "$USER_INPUT" | grep -qiE "meme|image|picture|draw|create.*art|generate.*art|generate.*image"; then
    echo -e "\033[1;36m🧠 $AGENT_NAME is brainstorming 3 visual concepts...\033[0m"
    VARIANTS_JSON=$(curl -s http://localhost:11434/api/chat -d "{
      \"model\": \"gemma3:4b\",
      \"stream\": false,
      \"messages\": [
        {\"role\": \"system\", \"content\": \"You are an AI creative director named $AGENT_NAME. The user wants an image about: '$USER_INPUT'. Provide EXACTLY 3 distinct, highly descriptive visual concepts for this image. Number them 1., 2., and 3. Do NOT include any text, words, or letters in the visual descriptions. Keep each concept to 1-2 sentences.\"}
      ]
    }" 2>/dev/null)
    
    VARIANTS=$(echo "$VARIANTS_JSON" | jq -r '.message.content // empty')
    
    echo -e "\033[1;35m🎨 Choose your meme variant:\033[0m"
    echo "$VARIANTS" | grep -E "^[1-3][\.\)]"
    echo ""
    printf "\033[1;37mEnter 1, 2, or 3 (or 'c' to cancel): \033[0m"
    read -r CHOICE

    if [[ "$CHOICE" =~ ^[1-3]$ ]]; then
      SELECTED_PROMPT=$(echo "$VARIANTS" | grep -E "^$CHOICE[\.\)]" | sed "s/^$CHOICE[\.\)][[:space:]]*//")
      IMGFILE="/tmp/undesirable_meme_$(date +%s).png"
      CLEAN_PROMPT="Cartoon meme illustration, funny and expressive: $SELECTED_PROMPT. Vibrant colors, clean composition, high quality digital art. Absolutely NO text, NO words, NO letters, NO writing in the image. [Seed: $RANDOM]"

      # Option 1: Ollama image model (cross-platform)
      if ollama list 2>/dev/null | grep -q "flux2-klein"; then
        IMGDIR=$(mktemp -d)
        # SECURITY: Pass prompt via stdin to avoid shell command substitution in double-quoted string
        echo -e "\033[1;35m🎨 Generating Option $CHOICE locally via Ollama...\033[0m"
        (cd "$IMGDIR" && printf '%s' "$CLEAN_PROMPT" | ollama run x/flux2-klein:4b 2>/dev/null)
        GEN_FILE=$(find "$IMGDIR" -maxdepth 1 -type f \( -name "*.png" -o -name "*.jpg" \) -print -quit 2>/dev/null)
        if [ -n "$GEN_FILE" ]; then
          mv "$GEN_FILE" "$IMGFILE"
          rm -rf "$IMGDIR"
          echo -e "\033[1;35m🖼️  Opening meme on screen...\033[0m"
          open "$IMGFILE"
        else
          rm -rf "$IMGDIR"
          echo -e "\033[0;33m(Image generation failed — try again)\033[0m"
        fi

      # Option 2: Draw Things API (macOS)
      elif curl -s "http://127.0.0.1:7860/sdapi/v1/samplers" &>/dev/null; then
        echo -e "\033[1;35m🎨 Generating Option $CHOICE via Draw Things...\033[0m"
        IMG_B64=$(curl -s -X POST "http://127.0.0.1:7860/sdapi/v1/txt2img" \
          -H "Content-Type: application/json" \
          -d "{\"prompt\": $(echo "$CLEAN_PROMPT" | jq -Rs .), \"steps\": 4, \"width\": 1024, \"height\": 1024}" \
          2>/dev/null | jq -r '.images[0] // empty' 2>/dev/null)
        if [ -n "$IMG_B64" ]; then
          echo "$IMG_B64" | base64 --decode > "$IMGFILE"
          echo -e "\033[1;35m🖼️  Opening meme on screen...\033[0m"
          open "$IMGFILE"
        fi

      else
        echo -e "\033[0;33m💡 To enable images: ollama pull x/flux2-klein:4b\033[0m"
      fi
    else
      echo -e "\033[0;33mAction canceled.\033[0m"
    fi
    echo ""
  fi
done
